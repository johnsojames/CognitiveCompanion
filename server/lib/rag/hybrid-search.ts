import { VectorStore } from '../vectorstore';

/**
 * Implements hybrid search combining vector and keyword-based search
 */
export class HybridSearch {
  private vectorStore: VectorStore;
  
  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
  }
  
  /**
   * Perform hybrid search using both vector similarity and keyword matching
   * @param query Search query
   * @param limit Maximum number of results
   * @returns Search results
   */
  async search(query: string, limit: number = 5): Promise<Array<{id: number, score: number, content: string}>> {
    try {
      // Get vector similarity results
      const vectorResults = await this.vectorStore.searchSimilarDocuments(query, limit * 2);
      
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
      const validResults = resultsWithContent.filter(r => r.content.length > 0);
      
      // Apply additional keyword-based scoring
      const enhancedResults = this.applyKeywordScoring(validResults, query);
      
      // Sort by combined score and limit results
      return enhancedResults
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error("Error in hybrid search:", error);
      return [];
    }
  }
  
  /**
   * Apply additional keyword-based scoring to search results
   * @param results Search results with content
   * @param query Original query
   * @returns Enhanced results with combined scores
   */
  private applyKeywordScoring(
    results: Array<{id: number, score: number, content: string}>,
    query: string
  ): Array<{id: number, score: number, content: string}> {
    // Extract keywords from query (simple approach - split by spaces and filter common words)
    const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'of']);
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
    
    if (keywords.length === 0) {
      return results; // No meaningful keywords to match
    }
    
    return results.map(result => {
      // Calculate keyword matches
      const content = result.content.toLowerCase();
      let keywordMatchScore = 0;
      
      // Count exact matches
      for (const keyword of keywords) {
        // Check for exact word matches using boundaries
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = content.match(regex);
        
        if (matches) {
          // More weight to matches near the beginning of the document
          const firstIndex = content.indexOf(keyword);
          const positionFactor = Math.max(0, 1 - (firstIndex / 1000));
          
          // Award points for each match, with diminishing returns
          keywordMatchScore += 0.05 * Math.min(5, matches.length) * (1 + positionFactor);
        }
      }
      
      // Combine scores (70% vector similarity, 30% keyword matches)
      const combinedScore = (result.score * 0.7) + (keywordMatchScore * 0.3);
      
      return {
        ...result,
        score: combinedScore
      };
    });
  }
}