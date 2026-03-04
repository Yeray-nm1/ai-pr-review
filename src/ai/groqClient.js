import OpenAI from 'openai';

function createGroqClient(apiKey, baseURL) {
  return new OpenAI({
    apiKey,
    baseURL,
  });
}

async function requestReview(groq, prompt, model) {
  return await groq.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  });
}

function cleanMarkdownFences(content) {
  let trimmedContent = content.trim();
  if (trimmedContent.startsWith('```')) {
    trimmedContent = trimmedContent.replace(/```json|```/g, '').trim();
  }
  return trimmedContent;
}

export { createGroqClient, requestReview, cleanMarkdownFences };