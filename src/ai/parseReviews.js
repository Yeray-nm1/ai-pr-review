import core from '@actions/core';

function parseAIResponse(content) {
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
      return undefined;
    }
  } catch (err) {
    core.warning('Model did not return valid JSON. Skipping review.');
    return undefined;
  }

  return reviews;
}

export { parseAIResponse };