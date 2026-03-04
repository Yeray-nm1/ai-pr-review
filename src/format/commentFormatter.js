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
  return `### 🤖 AI Code Review\n#### ${emoji} ${label}\n\n${review.comment}`;
}

export { formatReviewComment };