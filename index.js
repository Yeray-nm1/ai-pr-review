import core from '@actions/core';
import github from '@actions/github';
import OpenAI from 'openai';

const FRONTEND_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.astro'];

function isFrontendFile(filename) {
  return FRONTEND_EXTENSIONS.some((ext) => filename.endsWith(ext));
}

function getSeverityMeta(severity) {
  const normalized = String(severity || 'low').toLowerCase();
  if (normalized === 'high') {
    return { label: 'HIGH', emoji: '🔴' };
  }
  if (normalized === 'medium') {
    return { label: 'MEDIUM', emoji: '🟠' };
  }

  return { label: 'LOW', emoji: '🟡' };
}

function formatReviewComment(review) {
  const { label, emoji } = getSeverityMeta(review?.severity);
  return `### 🤖 AI Review\n#### ${emoji} ${label}\n\n**Problema detectado**\n${review.comment}\n\n**Cómo arreglarlo**\n- Corrige la causa raíz en este bloque de código.\n- Añade o ajusta una prueba para cubrir este caso.`;
}

function formatFollowUpComment(url, severity) {
  const { label, emoji } = getSeverityMeta(severity);
  return `### 🔁 Seguimiento AI Review\n#### ${emoji} ${label}\n\n**Estado**\nEste problema parece seguir presente en el commit actual.\n\n**Cómo arreglarlo**\n- Revisa el comentario original y aplica la corrección propuesta.\n- Verifica el cambio con tests o validación manual.\n\nReferencia: ${url}`;
}

async function run() {
  try {
    const token = process.env.GITHUB_TOKEN;
    const groqKey = core.getInput('groq_api_key', { required: true });
    const mode = core.getInput('mode') || 'frontend';
    const groqModel = core.getInput('groq_model') || 'llama-3.1-8b-instant';

    const { context } = github;
    const octokit = github.getOctokit(token);
    const groq = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    if (!context.payload.pull_request) {
      core.info('Not a pull request. Skipping.');
      return;
    }

    const { owner, repo } = context.repo;
    const pull_number = context.payload.pull_request.number;
    const commitId = context.payload.pull_request.head.sha;

    // Obtener archivos modificados
    const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number,
      per_page: 100,
    });

    const relevantFiles = files.filter(
      (f) => isFrontendFile(f.filename) && f.status !== 'removed' && f.patch
    );

    if (relevantFiles.length === 0) {
      core.info('No relevant frontend files changed.');
      return;
    }

    // Construir diff limitado
    let diffContent = '';
    for (const file of relevantFiles) {
      diffContent += `\n\nFILE: ${file.filename}\n${file.patch}`;
    }

    // Limitar tamaño (protección básica)
    if (diffContent.length > 15000) {
      diffContent = diffContent.slice(0, 15000);
    }

    const prompt = `
You are a strict senior frontend reviewer.

Stack: Astro + React + TypeScript.

Review ONLY for:
- Runtime bugs
- Security issues (XSS, unsafe HTML injection, unsafe eval)
- Performance problems
- Incorrect React hooks usage
- Misuse of Astro components
- TypeScript type errors

Do NOT comment on formatting or trivial style.

Return STRICT JSON object:

{
  "reviews": [
    {
      "file": "relative/path/file.tsx",
      "line": number,
      "severity": "low|medium|high",
      "comment": "clear actionable explanation"
    }
  ]
}

Diff:
${diffContent}
`;

    const response = await groq.chat.completions.create({
      model: groqModel,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });

    let content = (response.choices?.[0]?.message?.content || '').trim();

    // Intento defensivo para limpiar markdown si lo devuelve
    if (content.startsWith('```')) {
      content = content.replace(/```json|```/g, '').trim();
    }

    let reviews;
    try {
      const parsed = JSON.parse(content);
      reviews =
        (Array.isArray(parsed) && parsed) ||
        parsed.reviews ||
        parsed.issues ||
        parsed.comments ||
        (parsed.file && parsed.line && parsed.comment ? [parsed] : undefined);
      if (!Array.isArray(reviews)) {
        core.warning('Model returned JSON but not an array. Skipping review.');
        return;
      }
    } catch (err) {
      core.warning('Model did not return valid JSON. Skipping review.');
      return;
    }

    let hasCritical = false;

    // Preparar claves de revisiones actuales (file:line)
    const currentKeys = new Set();
    const reviewByKey = new Map();
    for (const r of reviews) {
      if (!r.file || !r.line) continue;
      const key = `${r.file}:${r.line}`;
      currentKeys.add(key);
      reviewByKey.set(key, r);
    }

    // Obtener comentarios previos de la PR
    const existingComments = await octokit.paginate(
      octokit.rest.pulls.listReviewComments,
      {
        owner,
        repo,
        pull_number,
        per_page: 100,
      }
    );

    const aiComments = existingComments.filter(
      (c) =>
        c.body &&
        (c.body.startsWith('**AI (') ||
          c.body.startsWith('### 🤖 AI Review') ||
          c.body.startsWith('### 🔁 Seguimiento AI Review'))
    );

    // Para cada comentario AI previo: si la issue ya no aparece en las reviews actuales, marcar resuelto; si sigue, dejar aviso
    for (const c of aiComments) {
      const key = `${c.path}:${c.line}`;
      if (currentKeys.has(key)) {
        const activeReview = reviewByKey.get(key);
        // Sigue presente -> añadir comentario indicando que sigue ocurriendo
        try {
          await octokit.rest.pulls.createReviewComment({
            owner,
            repo,
            pull_number,
            commit_id: commitId,
            body: formatFollowUpComment(c.html_url, activeReview?.severity),
            path: c.path,
            line: c.line,
            side: 'RIGHT',
          });
        } catch (e) {
          core.info(
            `Failed to post "still present" comment for ${c.path}:${c.line} - ${e.message}`
          );
        }
      } else {
        // No aparece en las reviews actuales -> intentar marcar thread resuelto via GraphQL
        if (c.node_id) {
          const mutation = `mutation ($threadId: ID!) { markPullRequestReviewThreadResolved(input: { threadId: $threadId }) { clientMutationId } }`;
          try {
            await octokit.graphql(mutation, { threadId: c.node_id });
            core.info(`Marked thread resolved: ${c.node_id}`);
          } catch (err) {
            core.info(`Failed to resolve thread ${c.node_id}: ${err.message}`);
          }
        } else {
          core.info(`No node_id for comment ${c.id}, cannot mark resolved.`);
        }
      }
    }

    // Publicar comentarios nuevos para las reviews actuales (si no existen ya)
    for (const review of reviews) {
      if (!review.file || !review.line || !review.comment) continue;

      if (review.severity === 'high') {
        hasCritical = true;
      }

      const exists = existingComments.some(
        (c) =>
          c.path === review.file &&
          c.line === review.line &&
          c.body &&
          c.body.includes(review.comment)
      );
      if (exists) {
        core.info(
          `Skipping duplicate comment for ${review.file}:${review.line}`
        );
        continue;
      }

      await octokit.rest.pulls.createReviewComment({
        owner,
        repo,
        pull_number,
        commit_id: commitId,
        body: formatReviewComment(review),
        path: review.file,
        line: review.line,
        side: 'RIGHT',
      });
    }

    if (hasCritical) {
      core.setFailed('Critical issues detected by AI reviewer.');
    } else {
      core.info('AI review completed without critical issues.');
    }
  } catch (error) {
    const message = error?.message || String(error);
    if (
      message.includes('Quota exceeded') ||
      message.includes('rate_limit') ||
      message.includes('billing') ||
      message.includes('429')
    ) {
      core.setFailed(
        `Groq quota/rate limit exceeded. Revisa los límites de tu cuenta o prueba otro modelo con input groq_model. Error original: ${message}`
      );
      return;
    }

    core.setFailed(message);
  }
}

run();
