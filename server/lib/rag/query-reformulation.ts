import { LLMFactory } from "../llm/factory";
import { ModelProvider } from "@shared/schema";

/**
 * Query reformulation result
 */
interface ReformulationResult {
  originalQuery: string;
  expandedQuery: string;
  alternativeQueries: string[];
}

/**
 * Query reformulation service to improve RAG search results
 */
export class QueryReformulation {
  private llmFactory: LLMFactory;
  private preferredProvider: ModelProvider = 'gpt';
  private preferredModel: string = 'gpt-4o';
  
  /**
   * Create a new query reformulation service
   * @param llmFactory LLM factory to use for generating reformulations
   */
  constructor(llmFactory: LLMFactory) {
    this.llmFactory = llmFactory;
  }
  
  /**
   * Set the preferred LLM provider and model
   * @param provider LLM provider
   * @param model Model name
   */
  setPreferredModel(provider: ModelProvider, model: string): void {
    this.preferredProvider = provider;
    this.preferredModel = model;
  }
  
  /**
   * Reformulate a query to improve search results
   * @param query Original query
   * @param context Optional context to help with reformulation
   * @returns Reformulated queries
   */
  async reformulateQuery(query: string, context?: string): Promise<ReformulationResult> {
    try {
      const llm = this.llmFactory.getLLMProvider(this.preferredProvider, this.preferredModel);
      
      // Build prompt for query reformulation
      const prompt = this.buildReformulationPrompt(query, context);
      
      // Generate reformulations
      const response = await llm.generateResponse(prompt, "", []);
      
      // Parse the response
      return this.parseReformulationResponse(query, response);
    } catch (error) {
      console.error("Error reformulating query:", error);
      // Return original query if reformulation fails
      return {
        originalQuery: query,
        expandedQuery: query,
        alternativeQueries: []
      };
    }
  }
  
  /**
   * Build a prompt for query reformulation
   * @param query Original query
   * @param context Optional context to help with reformulation
   * @returns Prompt for the LLM
   */
  private buildReformulationPrompt(query: string, context?: string): string {
    let prompt = `
You are a search query reformulation expert. Your task is to analyze the original query and generate:
1. An expanded version that includes relevant synonyms and related concepts
2. Three alternative phrasings that might yield better search results

The output should be in this format:
EXPANDED: <expanded query with synonyms and related terms>
ALT1: <alternative phrasing 1>
ALT2: <alternative phrasing 2>
ALT3: <alternative phrasing 3>

Original query: "${query}"
`;

    if (context) {
      prompt += `\nAdditional context that may help with reformulation:\n${context}\n`;
    }
    
    return prompt;
  }
  
  /**
   * Parse the LLM response into a structured result
   * @param originalQuery Original query
   * @param response LLM response
   * @returns Structured reformulation result
   */
  private parseReformulationResponse(originalQuery: string, response: string): ReformulationResult {
    try {
      const lines = response.split('\n').filter(line => line.trim().length > 0);
      
      let expandedQuery = originalQuery;
      const alternativeQueries: string[] = [];
      
      for (const line of lines) {
        if (line.startsWith('EXPANDED:')) {
          expandedQuery = line.replace('EXPANDED:', '').trim();
        } else if (line.startsWith('ALT1:') || line.startsWith('ALT2:') || line.startsWith('ALT3:')) {
          const alt = line.replace(/ALT\d:/, '').trim();
          if (alt) {
            alternativeQueries.push(alt);
          }
        }
      }
      
      return {
        originalQuery,
        expandedQuery,
        alternativeQueries
      };
    } catch (error) {
      console.error("Error parsing reformulation response:", error);
      return {
        originalQuery,
        expandedQuery: originalQuery,
        alternativeQueries: []
      };
    }
  }
  
  /**
   * Execute multiple searches with reformulated queries and merge results
   * This would be integrated with your search system
   * @param search Function that performs the actual search
   * @param query Original query
   * @param limit Maximum number of results
   * @returns Combined search results
   */
  async searchWithReformulation<T>(
    search: (query: string, limit: number) => Promise<T[]>,
    query: string,
    limit: number = 5
  ): Promise<T[]> {
    try {
      // Get reformulations
      const reformulations = await this.reformulateQuery(query);
      
      // Execute searches in parallel
      const searchPromises = [
        search(reformulations.originalQuery, limit),
        search(reformulations.expandedQuery, limit)
      ];
      
      // Add alternative queries
      for (const altQuery of reformulations.alternativeQueries) {
        searchPromises.push(search(altQuery, limit));
      }
      
      // Wait for all searches to complete
      const searchResults = await Promise.all(searchPromises);
      
      // Merge and deduplicate results
      // This assumes T has an 'id' property for deduplication
      const mergedResults: T[] = [];
      const seenIds = new Set<any>();
      
      // Helper to add unique results
      const addUniqueResults = (results: T[]) => {
        for (const result of results) {
          // @ts-ignore - Assuming T has an id property
          const id = result.id;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            mergedResults.push(result);
          }
        }
      };
      
      // Add results in order of priority
      // Original query results first
      addUniqueResults(searchResults[0]);
      
      // Expanded query results next
      addUniqueResults(searchResults[1]);
      
      // Alternative query results last
      for (let i = 2; i < searchResults.length; i++) {
        addUniqueResults(searchResults[i]);
      }
      
      // Limit final results
      return mergedResults.slice(0, limit);
    } catch (error) {
      console.error("Error in search with reformulation:", error);
      // Fallback to original search
      return search(query, limit);
    }
  }
}

// Create a singleton instance
let _instance: QueryReformulation | null = null;

/**
 * Get the query reformulation instance
 * @param llmFactory LLM factory to use
 * @returns QueryReformulation instance
 */
export function getQueryReformulation(llmFactory: LLMFactory): QueryReformulation {
  if (!_instance) {
    _instance = new QueryReformulation(llmFactory);
  }
  return _instance;
}