/**
 * Interface for LLM providers
 */
export interface LLMProvider {
  /**
   * Generate a response to a prompt
   * @param prompt The prompt to generate a response for
   * @param systemContext Additional system context
   * @param documentContexts Document contexts
   * @returns Generated response
   */
  generateResponse(prompt: string, systemContext: string, documentContexts: string[]): Promise<string>;
}