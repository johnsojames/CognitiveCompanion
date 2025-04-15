import { LLMFactory } from "../llm/factory";
import { HybridSearch } from "./hybrid-search";
import { getQueryReformulation, QueryReformulation } from "./query-reformulation";
import { ModelProvider } from "@shared/schema";
import { VectorStore } from "../vectorstore";

/**
 * Search result with source
 */
interface SearchResultWithSource {
  id: number;
  score: number;
  content: string;
  source: string; // Identifies where this result came from (which sub-query)
}

/**
 * A multi-step retrieval system for complex queries
 */
export class MultiStepRetrieval {
  private hybridSearch: HybridSearch;
  private queryReformulation: QueryReformulation;
  private llmFactory: LLMFactory;
  
  /**
   * Create a new multi-step retrieval system
   * @param vectorStore Vector store for searches
   * @param llmFactory LLM factory for query analysis
   */
  constructor(vectorStore: VectorStore, llmFactory: LLMFactory) {
    this.hybridSearch = new HybridSearch(vectorStore);
    this.queryReformulation = getQueryReformulation(llmFactory);
    this.llmFactory = llmFactory;
  }
  
  /**
   * Initialize the retrieval system
   * This should be called after document updates
   */
  async initialize(): Promise<void> {
    await this.hybridSearch.initializeIndex();
  }
  
  /**
   * Perform multi-step retrieval for a complex query
   * @param query The user's query
   * @param limit Maximum number of results to return
   * @returns Search results
   */
  async retrieveForComplexQuery(query: string, limit: number = 10): Promise<SearchResultWithSource[]> {
    try {
      // Step 1: Analyze the query to identify sub-questions
      const subQueries = await this.decomposeQuery(query);
      
      console.log(`Decomposed query "${query}" into ${subQueries.length} sub-queries:`);
      subQueries.forEach((sq, i) => console.log(`  ${i + 1}. ${sq}`));
      
      // Step 2: Perform search for each sub-query
      const allResults: SearchResultWithSource[] = [];
      
      for (const [index, subQuery] of subQueries.entries()) {
        // Use query reformulation for each sub-query
        const reformulations = await this.queryReformulation.reformulateQuery(subQuery);
        
        // Perform searches with original and reformulated queries
        const queries = [
          subQuery,
          reformulations.expandedQuery,
          ...reformulations.alternativeQueries
        ];
        
        for (const [queryIndex, q] of queries.entries()) {
          const source = `Sub-query ${index + 1}: ${subQuery} (variant ${queryIndex + 1})`;
          
          // Use hybrid search
          const results = await this.hybridSearch.search(q, Math.min(5, limit));
          
          // Add source information
          const resultsWithSource = results.map(r => ({
            ...r,
            source
          }));
          
          allResults.push(...resultsWithSource);
        }
      }
      
      // Step 3: Deduplicate and rank results
      const finalResults = this.combineAndRankResults(allResults, query, limit);
      
      return finalResults;
    } catch (error) {
      console.error("Error in multi-step retrieval:", error);
      
      // Fallback to basic search
      const fallbackResults = await this.hybridSearch.search(query, limit);
      return fallbackResults.map(r => ({
        ...r,
        source: "Fallback search"
      }));
    }
  }
  
  /**
   * Decompose a complex query into simpler sub-queries
   * @param query Complex query
   * @returns Array of simpler sub-queries
   */
  private async decomposeQuery(query: string): Promise<string[]> {
    try {
      // Use an LLM to analyze and decompose the query
      const llm = this.llmFactory.getLLMProvider('gpt', 'gpt-4o');
      
      const prompt = `
You are an expert at breaking down complex questions into simpler sub-questions.
Given the following complex query, decompose it into 2-5 simpler sub-queries that together would help answer the original query.
Respond with ONLY the sub-queries, one per line. DO NOT include any other explanations.

Complex query: "${query}"

Sub-queries:
`;
      
      const response = await llm.generateResponse(prompt, "", []);
      
      // Parse the response into sub-queries
      const subQueries = response
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => line.replace(/^\d+\.\s*/, '')); // Remove leading numbers
      
      // Always include the original query as one of the sub-queries
      if (!subQueries.includes(query)) {
        subQueries.push(query);
      }
      
      // Ensure we have at least one sub-query
      return subQueries.length > 0 ? subQueries : [query];
    } catch (error) {
      console.error("Error decomposing query:", error);
      return [query]; // Fallback to original query
    }
  }
  
  /**
   * Combine and rank search results from multiple sub-queries
   * @param results All search results
   * @param originalQuery The original query
   * @param limit Maximum number of results to return
   * @returns Combined and ranked results
   */
  private combineAndRankResults(
    results: SearchResultWithSource[],
    originalQuery: string,
    limit: number
  ): SearchResultWithSource[] {
    // Step 1: Deduplicate by document ID
    const uniqueResults = new Map<number, SearchResultWithSource>();
    
    for (const result of results) {
      // If we already have this document, keep the one with higher score
      const existing = uniqueResults.get(result.id);
      if (!existing || result.score > existing.score) {
        uniqueResults.set(result.id, result);
      }
    }
    
    // Step 2: Calculate relevance to original query using BM25-like scoring
    const deduplicatedResults = Array.from(uniqueResults.values());
    
    // Calculate relevance scores based on term overlap with original query
    const queryTerms = this.getQueryTerms(originalQuery);
    
    const scoredResults = deduplicatedResults.map(result => {
      const contentTerms = this.getQueryTerms(result.content);
      const overlapScore = this.calculateTermOverlap(queryTerms, contentTerms);
      
      // Combine with the original score
      const finalScore = (result.score * 0.7) + (overlapScore * 0.3);
      
      return {
        ...result,
        score: finalScore
      };
    });
    
    // Step 3: Sort by final score and limit results
    return scoredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  /**
   * Extract terms from a query for scoring
   * @param text Text to tokenize
   * @returns Array of terms
   */
  private getQueryTerms(text: string): string[] {
    // Simple tokenization
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 0);
  }
  
  /**
   * Calculate term overlap score between query and content
   * @param queryTerms Query terms
   * @param contentTerms Content terms
   * @returns Overlap score (0-1)
   */
  private calculateTermOverlap(queryTerms: string[], contentTerms: string[]): number {
    if (queryTerms.length === 0) return 0;
    
    // Count matching terms (with frequency)
    let matchCount = 0;
    const contentTermSet = new Set(contentTerms);
    
    for (const term of queryTerms) {
      if (contentTermSet.has(term)) {
        matchCount++;
      }
    }
    
    // Normalize by query length
    return matchCount / queryTerms.length;
  }
}