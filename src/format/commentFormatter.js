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

export { formatReviewComment, formatFollowUpComment };