function buildPrompt(mode, stack, diffContent) {
  const stackDescription = stack || 'Astro + React + TypeScript';

  return `You are a strict senior frontend reviewer.

Stack: ${stackDescription}.

IMPORTANT: Review ONLY the NEW code (lines starting with +), NOT the removed code (lines starting with -).

Review ONLY for:
- Runtime bugs
- Security issues (XSS, unsafe HTML injection, unsafe eval)
- Performance problems
- Incorrect React hooks usage
- Misuse of Astro components
- TypeScript type errors

Do NOT comment on formatting or trivial style.

The "line" number in your response must be the line number in the MODIFIED file (the new version).

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
}

export { buildPrompt };