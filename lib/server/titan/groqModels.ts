/** Groq retired Llama 3.x chat ids on 2026-08-16. Remap so stale Vercel env still works. */

const GROQ_RETIRED: Record<string, string> = {
  "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
  "llama-3.1-8b-instant": "openai/gpt-oss-20b",
  "llama-3.1-70b-versatile": "openai/gpt-oss-120b",
  "llama3-70b-8192": "openai/gpt-oss-120b",
  "llama3-8b-8192": "openai/gpt-oss-20b",
};

export const GROQ_DEFAULT_STRONG = "openai/gpt-oss-120b";
export const GROQ_DEFAULT_FAST = "openai/gpt-oss-20b";

export function remapGroqModel(model: string, baseUrl: string): string {
  if (!/groq\.com/i.test(baseUrl)) return model;
  return GROQ_RETIRED[model] ?? model;
}
