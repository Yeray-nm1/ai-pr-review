import { FRONTEND_EXTENSIONS, MAX_DIFF_SIZE } from '../config.js';

function isFrontendFile(filename) {
  return FRONTEND_EXTENSIONS.some((ext) => filename.endsWith(ext));
}

function isValidFile(file) {
  return isFrontendFile(file.filename) && file.status !== 'removed' && file.patch;
}

function buildDiffContent(files) {
  let diffContent = '';
  for (const file of files) {
    const fileDiff = `\n\nFILE: ${file.filename}\n${file.patch}`;
    if (diffContent.length + fileDiff.length > MAX_DIFF_SIZE) {
      break;
    }
    diffContent += fileDiff;
  }

  return diffContent;
}

export { isFrontendFile, isValidFile, buildDiffContent };