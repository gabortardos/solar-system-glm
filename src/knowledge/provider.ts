/**
 * Knowledge layer — LLM data pipeline (Step 8 scope).
 * Providers are pluggable (any OpenAI-compatible endpoint). UI consumes via engine services.
 */

export interface LlmMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface LlmProvider {
  /** Answer a contextual question about what the user has targeted. */
  answer(messages: readonly LlmMessage[]): Promise<string>;
}
