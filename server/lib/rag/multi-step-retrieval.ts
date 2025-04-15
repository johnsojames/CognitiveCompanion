import { LLMFactory } from '../llm/factory';
import { VectorStore } from '../vectorstore';

/**
 * Implements multi-step retrieval for more context-aware document search
 */
export class MultiStepRetrieval {
  private llmFactory: LLMFactory;
  private vectorStore: VectorStore;
  
  constructor(llmFactory: LLMFactory, vectorStore: VectorStore) {
    this.llmFactory = llmFactory;
    this.vectorStore = vectorStore;
  }
  
  /**
   * Retrieve documents using multi-step process:
   * 1. Generate search sub-queries based on the main query
   * 2. Execute multiple searches with different perspectives
   * 3. Merge and rank results with contextual understanding
   * 
   * @param query Main search query
   * @param limit Maximum number of results to return
   * @returns Array of document results with scores and content
   */
  async retrieveDocuments(query: string, limit: number = 5): Promise<Array<{id: number, score: number, content: string}>> {
    try {
      // 1. Generate search sub-queries
      const subQueries = await this.generateSubQueries(query);
      
      // 2. Execute multiple searches
      const allResults: Array<{id: number, score: number, content: string}> = [];
      
      // First, direct search with the original query
      const directResults = await this.executeSearch(query, limit);
      allResults.push(...directResults);
      
      // Then search with each sub-query
      for (const subQuery of subQueries) {
        const subResults = await this.executeSearch(subQuery, Math.max(3, Math.floor(limit / 2)));
        allResults.push(...subResults);
      }
      
      // 3. Merge and deduplicate results
      const uniqueResults = this.deduplicateAndMergeResults(allResults);
      
      // 4. Rerank results based on relevance to original query
      const rerankedResults = await this.reRankResults(uniqueResults, query);
      
      // Return top results
      return rerankedResults.slice(0, limit);
    } catch (error) {
      console.error("Error in multi-step retrieval:", error);
      return [];
    }
  }
  
  /**
   * Generate diverse search sub-queries from main query
   * @param query Main query
   * @returns Array of sub-queries
   */
  private async generateSubQueries(query: string): Promise<string[]> {
    try {
      // Use Claude model if available, as it's good for inference tasks
      const llm = this.llmFactory.getLLMProvider("claude", "claude-3-7-sonnet-20250219");
      
      const prompt = `Given the search query: "${query}"
      
Generate 3 different search sub-queries that explore different aspects or perspectives of this query.
The sub-queries should:
1. Be more specific than the original query
2. Focus on different aspects of the original query
3. Use different keywords and phrasings

Format your response as a numbered list with only the sub-queries, nothing else.
Example:
1. First sub-query
2. Second sub-query
3. Third sub-query`;
      
      const response = await llm.generateResponse(prompt, "", []);
      
      // Parse response to extract sub-queries
      const subQueries = response
        .split("\n")
        .map(line => line.trim())
        .filter(line => /^\d+\./.test(line)) // Lines starting with a number and period
        .map(line => line.replace(/^\d+\.\s*/, '').trim()) // Remove the number prefix
        .filter(line => line.length > 0);
      
      // Ensure we have at least one sub-query, or use fallback approach
      if (subQueries.length === 0) {
        return this.generateFallbackSubQueries(query);
      }
      
      return subQueries.slice(0, 3); // Limit to 3 sub-queries
    } catch (error) {
      console.error("Error generating sub-queries:", error);
      return this.generateFallbackSubQueries(query);
    }
  }
  
  /**
   * Generate fallback sub-queries using rule-based approach
   * @param query Original query
   * @returns Array of sub-queries
   */
  private generateFallbackSubQueries(query: string): string[] {
    const subQueries: string[] = [];
    
    // 1. Add "definition of" prefix
    subQueries.push(`definition of ${query}`);
    
    // 2. Add "example of" prefix
    subQueries.push(`example of ${query}`);
    
    // 3. Extract key terms and create a more focused query
    const words = query.split(/\s+/);
    if (words.length > 3) {
      // Extract what seem to be the most important words (longer than 3 chars)
      const keyTerms = words.filter(word => word.length > 3);
      if (keyTerms.length > 1) {
        subQueries.push(keyTerms.slice(0, 3).join(' '));
      }
    }
    
    return subQueries;
  }
  
  /**
   * Execute a single search query
   * @param query Search query
   * @param limit Result limit
   * @returns Search results
   */
  private async executeSearch(query: string, limit: number): Promise<Array<{id: number, score: number, content: string}>> {
    try {
      // Get vector similarity results
      const vectorResults = await this.vectorStore.searchSimilarDocuments(query, limit);
      
      // For each result, fetch the document content
      const resultsWithContent = await Promise.all(
        vectorResults.map(async (result) => {
          const content = await this.vectorStore.getDocumentById(result.id);
          return {
            id: result.id,
            score: result.score,
            content: content || ""
          };
        })
      );
      
      // Filter out results with empty content
      return resultsWithContent.filter(r => r.content.length > 0);
    } catch (error) {
      console.error("Error in execute search:", error);
      return [];
    }
  }
  
  /**
   * Deduplicate and merge results from multiple searches
   * @param results Combined results from all searches
   * @returns Deduplicated results with merged scores
   */
  private deduplicateAndMergeResults(results: Array<{id: number, score: number, content: string}>): Array<{id: number, score: number, content: string}> {
    // Group by document ID
    const groupedById = new Map<number, {id: number, scores: number[], content: string}>();
    
    for (const result of results) {
      if (!groupedById.has(result.id)) {
        groupedById.set(result.id, {
          id: result.id,
          scores: [result.score],
          content: result.content
        });
      } else {
        // Add score to existing entry
        groupedById.get(result.id)!.scores.push(result.score);
      }
    }
    
    // Calculate merged scores (using max score, not average)
    return Array.from(groupedById.values()).map(entry => ({
      id: entry.id,
      score: Math.max(...entry.scores), // Use maximum score among all queries
      content: entry.content
    }));
  }
  
  /**
   * Re-rank results based on contextual relevance to original query
   * @param results Results to re-rank
   * @param originalQuery Original search query
   * @returns Re-ranked results
   */
  private async reRankResults(
    results: Array<{id: number, score: number, content: string}>,
    originalQuery: string
  ): Promise<Array<{id: number, score: number, content: string}>> {
    // For smaller result sets, just sort by score
    if (results.length <= 3) {
      return results.sort((a, b) => b.score - a.score);
    }
    
    try {
      // For larger sets, use a more sophisticated re-ranking approach
      // Extract key terms from the query
      const queryTerms = originalQuery
        .toLowerCase()
        .split(/\s+/)
        .filter(term => term.length > 3);
      
      return results.map(result => {
        const content = result.content.toLowerCase();
        let boostScore = 0;
        
        // Check for presence of query terms
        for (const term of queryTerms) {
          // More weight to terms in title-like positions (first few sentences)
          const firstParagraph = content.split('\n\n')[0] || '';
          const firstSentences = firstParagraph.split('.').slice(0, 2).join('.');
          
          if (firstSentences.includes(term)) {
            boostScore += 0.2; // Significant boost for terms in beginning
          } else if (content.includes(term)) {
            boostScore += 0.1; // Smaller boost for terms anywhere
          }
        }
        
        // Adjust final score (combining vector similarity with term matching)
        const adjustedScore = result.score * (1 + boostScore);
        
        return {
          ...result,
          score: adjustedScore
        };
      }).sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error("Error in re-ranking:", error);
      return results.sort((a, b) => b.score - a.score);
    }
  }
}