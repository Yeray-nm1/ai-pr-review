import core from '@actions/core';
import { PAGINATION_PAGE_SIZE } from '../config.js';

async function getExistingComments(octokit, owner, repo, pull_number) {
  return octokit.paginate(octokit.rest.pulls.listReviewComments, {
    owner,
    repo,
    pull_number,
    per_page: PAGINATION_PAGE_SIZE,
  });
}

function isAIComment(body) {
  return (
    body.startsWith('**AI (') ||
    body.startsWith('### 🤖 AI Review') ||
    body.startsWith('### 🔁 Seguimiento AI Review')
  );
}

function filterAIComments(comments) {
  return comments.filter((c) => c.body && isAIComment(c.body));
}

function commentExists(comments, review) {
  return comments.some(
    (c) =>
      c.path === review.file &&
      c.line === review.line &&
      c.body &&
      c.body.includes(review.comment)
  );
}

async function postReviewComment(
  octokit,
  owner,
  repo,
  pull_number,
  commitId,
  review,
  body
) {
  await octokit.rest.pulls.createReviewComment({
    owner,
    repo,
    pull_number,
    commit_id: commitId,
    body,
    path: review.file,
    line: review.line,
    side: 'RIGHT',
  });
}

async function markThreadResolved(octokit, nodeId) {
  if (!nodeId) {
    core.info(`No node_id for comment, cannot mark resolved.`);
    return;
  }

  const mutation = `mutation ($threadId: ID!) { markPullRequestReviewThreadResolved(input: { threadId: $threadId }) { clientMutationId } }`;
  try {
    await octokit.graphql(mutation, { threadId: nodeId });
    core.info(`Marked thread resolved: ${nodeId}`);
  } catch (err) {
    core.info(`Failed to resolve thread ${nodeId}: ${err.message}`);
  }
}

export {
  getExistingComments,
  filterAIComments,
  isAIComment,
  commentExists,
  postReviewComment,
  markThreadResolved,
};