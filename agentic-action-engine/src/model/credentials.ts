/** Resolve a model provider from ambient credentials. Fails closed when unset so a
 *  model-backed run can never happen (and be misreported) without real evidence. */
export function findModelCredential(names: string[]): { name: string; value: string } | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value && !/^\s*$/.test(value)) return { name, value };
  }
  return undefined;
}

export class ModelCredentialsMissingError extends Error {
  constructor(readonly candidates: string[]) {
    super(`No model provider credentials present among: ${candidates.join(', ')}`);
    this.name = 'ModelCredentialsMissingError';
  }
}

export function missingModelCredentials(): Error {
  return new ModelCredentialsMissingError(['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'MISTRAL_API_KEY', 'GROQ_API_KEY', 'HF_TOKEN']);
}