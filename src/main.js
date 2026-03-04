import core from '@actions/core';
import github from '@actions/github';
import { getInputs, GROQ_BASE_URL, DEFAULT_STACK } from './config.js';
import { createGroqClient, requestReview, cleanMarkdownFences } from './ai/groqClient.js';
import { isValidFile, buildDiffContent } from './utils/fileFilters.js';
import { formatReviewComment, formatFollowUpComment } from './format/commentFormatter.js';
import { getPRFiles, filterRelevantFiles } from './github/prFiles.js';
import {
  getExistingComments,
  filterAIComments,
  commentExists,
  postReviewComment,
  postFollowUpComment,
  markThreadResolved,
} from './github/reviewComments.js';
import { buildPrompt } from './ai/promptLoader.js';
import { parseAIResponse } from './ai/parseReviews.js';

async function run() {
  try {
    const token = process.env.GITHUB_TOKEN;
    const { groqKey, mode, groqModel } = getInputs();

    const { context } = github;
    const octokit = github.getOctokit(token);
    const groq = createGroqClient(groqKey, GROQ_BASE_URL);

    if (!context.payload.pull_request) {
      core.info('Not a pull request. Skipping.');
      return;
    }

    const { owner, repo } = context.repo;
    const pull_number = context.payload.pull_request.number;
    const commitId = context.payload.pull_request.head.sha;

    const files = await getPRFiles(octokit, owner, repo, pull_number);
    const relevantFiles = filterRelevantFiles(files, isValidFile);

    if (relevantFiles.length === 0) {
      core.info('No relevant frontend files changed.');
      return;
    }

    const diffContent = buildDiffContent(relevantFiles);

    const prompt = buildPrompt(mode, DEFAULT_STACK, diffContent);

    const response = await requestReview(groq, prompt, groqModel);

    let content = cleanMarkdownFences(response.choices?.[0]?.message?.content || '');

    const reviews = parseAIResponse(content);

    if (!reviews) {
      return;
    }

    let hasCritical = false;

    const currentKeys = new Set();
    const reviewByKey = new Map();
    for (const r of reviews) {
      if (!r.file || !r.line) continue;
      const key = `${r.file}:${r.line}`;
      currentKeys.add(key);
      reviewByKey.set(key, r);
    }

    const existingComments = await getExistingComments(octokit, owner, repo, pull_number);
    const aiComments = filterAIComments(existingComments);

    for (const c of aiComments) {
      const key = `${c.path}:${c.line}`;
      if (currentKeys.has(key)) {
        const activeReview = reviewByKey.get(key);
        await postFollowUpComment(
          octokit,
          owner,
          repo,
          pull_number,
          commitId,
          c,
          activeReview,
          formatFollowUpComment
        );
      } else {
        await markThreadResolved(octokit, c.node_id);
      }
    }

    for (const review of reviews) {
      if (!review.file || !review.line || !review.comment) continue;

      if (review.severity === 'high') {
        hasCritical = true;
      }

      const exists = commentExists(existingComments, review);
      if (exists) {
        core.info(
          `Skipping duplicate comment for ${review.file}:${review.line}`
        );
        continue;
      }

      await postReviewComment(
        octokit,
        owner,
        repo,
        pull_number,
        commitId,
        review,
        formatReviewComment(review)
      );
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

export { run };