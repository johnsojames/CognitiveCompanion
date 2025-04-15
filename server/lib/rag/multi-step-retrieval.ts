import { LLMFactory, LLMProvider } from '../llm/factory';
import { VectorStore } from '../vectorstore';
import { storage } from '../../storage';

/**
 * Multi-step retrieval for complex queries
 * 
 * This class implements a multi-step retrieval process for complex queries:
 * 1. Query decomposition: Break a complex query into simpler sub-queries
 * 2. Sub-query execution: Perform search for each sub-query
 * 3. Result aggregation: Combine results and remove duplicates
 */
export class MultiStepRetrieval {
  private vectorStore: VectorStore;
  private llmFactory: LLMFactory;
  private llmProvider: LLMProvider | null = null;
  
  /**
   * Create a new multi-step retrieval instance
   * @param vectorStore Vector store for document retrieval
   * @param llmFactory LLM factory for query decomposition
   */
  constructor(vectorStore: VectorStore, llmFactory: LLMFactory) {
    this.vectorStore = vectorStore;
    this.llmFactory = llmFactory;
  }
  
  /**
   * Initialize the multi-step retrieval
   */
  async initialize(): Promise<void> {
    try {
      // Initialize LLM provider for decomposition
      this.llmProvider = this.llmFactory.getLLMProvider('gpt', 'gpt-4o');
      console.log("Multi-step retrieval initialized with default LLM provider");
    } catch (error) {
      console.error("Error initializing multi-step retrieval:", error);
    }
  }
  
  /**
   * Retrieve documents for a complex query
   * @param query Complex query
   * @param limit Maximum number of results
   * @returns Search results with scores
   */
  async retrieveForComplexQuery(query: string, limit: number = 5): Promise<any[]> {
    try {
      if (!this.llmProvider) {
        await this.initialize();
      }
      
      if (!this.llmProvider) {
        throw new Error("LLM provider not initialized");
      }
      
      // Step 1: Decompose the query into sub-queries
      const subQueries = await this.decomposeQuery(query);
      
      // Step 2: Execute each sub-query
      const subResults = await Promise.all(
        subQueries.map(async (subQuery) => {
          const results = await this.vectorStore.searchSimilarDocuments(subQuery, Math.ceil(limit * 1.5));
          return results.map(result => [result.id, result.score] as [number, number]);
        })
      );
      
      // Step 3: Aggregate results
      const aggregatedResults = this.aggregateResults(subResults, limit);
      
      // Get document contents
      const documents = [];
      
      for (const [id, score] of aggregatedResults) {
        const document = await storage.getDocument(Number(id));
        if (document) {
          const content = await this.vectorStore.getDocumentById(Number(id));
          if (content) {
            documents.push({
              id: document.id,
              title: document.title,
              content: content,
              score: score
            });
          }
        }
      }
      
      return documents;
    } catch (error) {
      console.error("Error in multi-step retrieval:", error);
      throw error;
    }
  }
  
  /**
   * Decompose a complex query into simpler sub-queries
   * @param query Complex query
   * @returns List of sub-queries
   */
  private async decomposeQuery(query: string): Promise<string[]> {
    try {
      if (!this.llmProvider) {
        throw new Error("LLM provider not initialized");
      }
      
      const prompt = `
You are an expert at breaking down complex questions into simpler sub-questions.

Original complex query: "${query}"

Please break this down into 2-4 simpler sub-queries that together would help answer the original question.
Return ONLY a JSON array of strings with each string being a sub-query. Do not include any other text.
Example: ["sub-query 1", "sub-query 2", "sub-query 3"]
`;
      
      const response = await this.llmProvider.generateResponse(prompt, "", []);
      
      try {
        // Extract JSON array from response
        const jsonMatch = response.match(/\[\s*".*"\s*\]/s);
        if (jsonMatch) {
          const subQueries = JSON.parse(jsonMatch[0]);
          if (Array.isArray(subQueries) && subQueries.length > 0) {
            console.log(`Decomposed query into ${subQueries.length} sub-queries`);
            return subQueries;
          }
        }
        
        // Fallback: Just use the original query
        return [query];
      } catch (error) {
        console.error("Error parsing sub-queries:", error);
        return [query];
      }
    } catch (error) {
      console.error("Error decomposing query:", error);
      return [query];
    }
  }
  
  /**
   * Aggregate results from sub-queries
   * @param subResults Results from sub-queries
   * @param limit Maximum number of results
   * @returns Aggregated results
   */
  private aggregateResults(subResults: [number, number][][], limit: number): [number, number][] {
    // Combine all results and track their scores
    const scoreMap = new Map<number, number>();
    
    for (const results of subResults) {
      for (const [id, score] of results) {
        // Update score with maximum score seen for this document
        if (!scoreMap.has(id) || scoreMap.get(id)! < score) {
          scoreMap.set(id, score);
        }
      }
    }
    
    // Convert map to array and sort by score
    return Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }
}