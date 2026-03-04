import core from '@actions/core';

const FRONTEND_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.astro'];

const MAX_DIFF_SIZE = 15000;
const PAGINATION_PAGE_SIZE = 100;
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_STACK = 'Astro + React + TypeScript';

function getInputs() {
  return {
    groqKey: core.getInput('groq_api_key', { required: true }),
    mode: core.getInput('mode') || 'frontend',
    groqModel: core.getInput('groq_model') || 'llama-3.1-8b-instant',
  };
}

export {
  FRONTEND_EXTENSIONS,
  MAX_DIFF_SIZE,
  PAGINATION_PAGE_SIZE,
  GROQ_BASE_URL,
  DEFAULT_STACK,
  getInputs,
};