import { PAGINATION_PAGE_SIZE } from '../config.js';

async function getPRFiles(octokit, owner, repo, pull_number) {
  return octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number,
    per_page: PAGINATION_PAGE_SIZE,
  });
}

function filterRelevantFiles(files, isValidFile) {
  return files.filter(isValidFile);
}

export { getPRFiles, filterRelevantFiles };