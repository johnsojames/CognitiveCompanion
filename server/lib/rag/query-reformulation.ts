import { LLMFactory } from '../llm/factory';

/**
 * Implements query reformulation techniques to improve search results
 */
export class QueryReformulation {
  private llmFactory: LLMFactory;
  
  constructor(llmFactory: LLMFactory) {
    this.llmFactory = llmFactory;
  }
  
  /**
   * Reformulate a query to improve search effectiveness
   * @param query Original query
   * @returns Reformulated query or null if reformulation failed
   */
  async reformulateQuery(query: string): Promise<string | null> {
    // Check if the query actually needs reformulation
    if (!this.needsReformulation(query)) {
      return query; // Use original query if it's already good
    }
    
    try {
      // Try to use LLM for reformulation first
      const llmReformulated = await this.llmReformulate(query);
      if (llmReformulated) {
        return llmReformulated;
      }
      
      // Fall back to rule-based reformulation
      return this.ruleBasedReformulate(query);
    } catch (error) {
      console.error("Error in query reformulation:", error);
      return query; // Return original query on error
    }
  }
  
  /**
   * Check if a query needs reformulation
   * @param query Query to check
   * @returns True if query should be reformulated
   */
  private needsReformulation(query: string): boolean {
    const queryLength = query.trim().length;
    
    // Very short queries can benefit from expansion
    if (queryLength < 5) return true;
    
    // Very long queries can benefit from focusing
    if (queryLength > 200) return true;
    
    // Single word queries generally need expansion
    if (!query.includes(' ')) return true;
    
    // Queries that are questions can benefit from extraction
    if (query.includes('?')) return true;
    
    // Check for vague terms that indicate reformulation could help
    const vaguePhrases = ['this', 'that', 'what', 'how', 'tell me about', 'explain'];
    for (const phrase of vaguePhrases) {
      if (query.toLowerCase().includes(phrase)) return true;
    }
    
    return false; // No obvious need for reformulation
  }
  
  /**
   * Use LLM to reformulate query
   * @param query Original query
   * @returns Reformulated query or null if operation failed
   */
  private async llmReformulate(query: string): Promise<string | null> {
    try {
      // Try Claude model if available
      const llm = this.llmFactory.getLLMProvider("claude", "claude-3-7-sonnet-20250219");
      
      const prompt = `I need help reformulating the following search query to make it more effective for document retrieval.

Original query: "${query}"

Please reformulate this query to:
1. Make it more precise and specific
2. Include relevant keywords
3. Remove any unnecessary conversational elements
4. Convert questions into keyword-rich statements
5. Keep it concise (under 30 words)

Only provide the reformulated query, nothing else. Do not use quotation marks in your response.`;

      const response = await llm.generateResponse(prompt, "", []);
      
      // Validate the response
      const reformulated = response.trim();
      if (reformulated && reformulated.length > 0 && reformulated !== query) {
        return reformulated;
      }
      
      return null; // LLM didn't provide a good reformulation
    } catch (error) {
      console.error("Error in LLM query reformulation:", error);
      return null;
    }
  }
  
  /**
   * Use rule-based techniques to reformulate query
   * @param query Original query
   * @returns Reformulated query
   */
  private ruleBasedReformulate(query: string): string {
    const originalQuery = query.trim();
    let reformulated = originalQuery;
    
    // Remove common conversational starters
    const conversationalPrefixes = [
      'can you', 'could you', 'please', 'i want to know', 
      'tell me about', 'what is', 'how to', 'explain'
    ];
    
    for (const prefix of conversationalPrefixes) {
      if (reformulated.toLowerCase().startsWith(prefix)) {
        reformulated = reformulated.substring(prefix.length).trim();
      }
    }
    
    // Remove question marks and other unnecessary punctuation
    reformulated = reformulated.replace(/\?+/g, '');
    reformulated = reformulated.replace(/[!.,;:]+/g, ' ');
    
    // Remove filler words
    const fillerWords = ['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been'];
    let words = reformulated.split(/\s+/).filter(word => !fillerWords.includes(word.toLowerCase()));
    
    // If we have a very short query, try to add context from the original
    if (words.length < 2 && originalQuery.split(/\s+/).length > words.length) {
      const originalWords = originalQuery.split(/\s+/);
      const meaningfulWords = originalWords.filter(
        word => word.length > 3 && !fillerWords.includes(word.toLowerCase())
      );
      if (meaningfulWords.length > words.length) {
        words = meaningfulWords;
      }
    }
    
    // Rejoin words
    reformulated = words.join(' ').trim();
    
    // If somehow we've completely lost the query, revert to original
    if (reformulated.length < 2) {
      return originalQuery;
    }
    
    return reformulated;
  }
}