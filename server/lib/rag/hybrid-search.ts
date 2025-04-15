import { VectorStore } from "../vectorstore";
import { storage } from "../../storage";

/**
 * BM25 scoring parameters
 */
interface BM25Params {
  k1: number; // Term frequency saturation parameter
  b: number;  // Document length normalization parameter
}

/**
 * Search result with score
 */
interface SearchResult {
  id: number;
  score: number;
  content: string;
}

/**
 * Hybrid search combining vector similarity and keyword search
 */
export class HybridSearch {
  private vectorStore: VectorStore;
  private documentCache: Map<number, string> = new Map();
  private documentFrequency: Map<string, number> = new Map();
  private documentLengths: Map<number, number> = new Map();
  private avgDocumentLength: number = 0;
  private totalDocuments: number = 0;
  
  // BM25 default parameters
  private bm25Params: BM25Params = {
    k1: 1.2,
    b: 0.75
  };
  
  /**
   * Create a new hybrid search instance
   * @param vectorStore Vector store to use for semantic search
   */
  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
  }
  
  /**
   * Initialize BM25 index from documents
   * This should be called when new documents are added
   */
  async initializeIndex(): Promise<void> {
    // Reset state
    this.documentFrequency = new Map();
    this.documentLengths = new Map();
    this.documentCache = new Map();
    this.totalDocuments = 0;
    
    try {
      // We'd need a method to get all documents
      // This is a placeholder implementation
      const documents = await this.getAllDocuments();
      
      this.totalDocuments = documents.length;
      let totalLength = 0;
      
      // First pass: calculate document lengths and cache content
      for (const doc of documents) {
        const { id, content } = doc;
        
        // Cache document content
        this.documentCache.set(id, content);
        
        // Calculate document length (in terms)
        const terms = this.tokenize(content);
        const length = terms.length;
        this.documentLengths.set(id, length);
        totalLength += length;
        
        // Calculate document frequency for each term
        const uniqueTerms = new Set(terms);
        for (const term of uniqueTerms) {
          const currentFreq = this.documentFrequency.get(term) || 0;
          this.documentFrequency.set(term, currentFreq + 1);
        }
      }
      
      // Calculate average document length
      this.avgDocumentLength = totalLength / this.totalDocuments;
      
      console.log(`BM25 index initialized with ${this.totalDocuments} documents`);
      console.log(`Average document length: ${this.avgDocumentLength.toFixed(2)} terms`);
      console.log(`Vocabulary size: ${this.documentFrequency.size} terms`);
    } catch (error) {
      console.error("Error initializing BM25 index:", error);
      throw error;
    }
  }
  
  /**
   * Perform hybrid search combining vector and keyword search
   * @param query Search query
   * @param limit Maximum number of results
   * @param vectorWeight Weight of vector search (0-1)
   * @returns Ranked search results
   */
  async search(query: string, limit: number = 5, vectorWeight: number = 0.7): Promise<SearchResult[]> {
    try {
      // Perform vector search
      const vectorResults = await this.vectorStore.searchSimilarDocuments(query, limit * 2);
      
      // Ensure documents are cached for BM25 scoring
      for (const result of vectorResults) {
        if (!this.documentCache.has(result.id)) {
          const content = await this.vectorStore.getDocumentById(result.id);
          if (content) {
            this.documentCache.set(result.id, content);
            
            // Calculate document length if needed
            if (!this.documentLengths.has(result.id)) {
              const terms = this.tokenize(content);
              this.documentLengths.set(result.id, terms.length);
            }
          }
        }
      }
      
      // Calculate BM25 scores for the vector results
      const docIds = vectorResults.map(r => r.id);
      const bm25Scores = this.getBM25Scores(query, docIds);
      
      // Get vector scores map
      const vectorScoresMap = new Map(
        vectorResults.map(r => [r.id, r.score])
      );
      
      // Combine scores
      const combinedResults: SearchResult[] = [];
      
      for (const id of docIds) {
        const vectorScore = vectorScoresMap.get(id) || 0;
        const bm25Score = bm25Scores.get(id) || 0;
        
        // Normalize vector score to 0-1 range (already in this range)
        // Normalize BM25 score (can be larger than 1)
        const maxBM25Score = Math.max(...bm25Scores.values());
        const normalizedBM25Score = maxBM25Score > 0 ? bm25Score / maxBM25Score : 0;
        
        // Weighted combination
        const combinedScore = (vectorWeight * vectorScore) + 
                             ((1 - vectorWeight) * normalizedBM25Score);
        
        combinedResults.push({
          id,
          score: combinedScore,
          content: this.documentCache.get(id) || ""
        });
      }
      
      // Sort by combined score and limit results
      return combinedResults
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error("Error in hybrid search:", error);
      throw error;
    }
  }
  
  /**
   * Calculate BM25 scores for documents
   * @param query Search query
   * @param docIds Document IDs to score
   * @returns Map of document IDs to scores
   */
  private getBM25Scores(query: string, docIds: number[]): Map<number, number> {
    const queryTerms = this.tokenize(query);
    const scores = new Map<number, number>();
    
    // Initialize scores to zero
    for (const id of docIds) {
      scores.set(id, 0);
    }
    
    // Score each document
    for (const term of queryTerms) {
      // Skip terms that don't appear in any document
      if (!this.documentFrequency.has(term)) continue;
      
      const df = this.documentFrequency.get(term) || 0;
      
      // Skip terms that appear in all documents (stop words)
      if (df >= this.totalDocuments) continue;
      
      // Calculate inverse document frequency
      const idf = Math.log((this.totalDocuments - df + 0.5) / (df + 0.5) + 1);
      
      for (const id of docIds) {
        // Get document content
        const content = this.documentCache.get(id);
        if (!content) continue;
        
        // Calculate term frequency
        const tf = this.getTermFrequency(content, term);
        
        // Skip if term doesn't appear in document
        if (tf === 0) continue;
        
        // Get document length
        const docLength = this.documentLengths.get(id) || this.avgDocumentLength;
        
        // Calculate BM25 score for this term
        const { k1, b } = this.bm25Params;
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (docLength / this.avgDocumentLength));
        const termScore = idf * (numerator / denominator);
        
        // Add to document score
        const currentScore = scores.get(id) || 0;
        scores.set(id, currentScore + termScore);
      }
    }
    
    return scores;
  }
  
  /**
   * Calculate term frequency in a document
   * @param content Document content
   * @param term Term to count
   * @returns Term frequency
   */
  private getTermFrequency(content: string, term: string): number {
    const terms = this.tokenize(content);
    let count = 0;
    
    for (const t of terms) {
      if (t === term) count++;
    }
    
    return count;
  }
  
  /**
   * Tokenize text into terms
   * @param text Text to tokenize
   * @returns Array of terms
   */
  private tokenize(text: string): string[] {
    // Simple tokenization (could be improved with stemming, etc.)
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 0);
  }
  
  /**
   * Get all documents from storage
   * This would need to be implemented based on your storage system
   * @private
   */
  private async getAllDocuments(): Promise<Array<{id: number, content: string}>> {
    try {
      // Fetch all documents from the storage
      const documents = [];
      const allDocs = await Promise.all([
        // Use existing methods in storage to get all documents
        storage.getDocumentsByUserId(1) // This is a placeholder, we should get all users
      ]);
      
      // Flatten the array
      const flatDocs = allDocs.flat();
      
      // Fetch content for each document
      for (const doc of flatDocs) {
        const content = await this.vectorStore.getDocumentById(doc.id);
        if (content) {
          documents.push({ id: doc.id, content });
        }
      }
      
      return documents;
    } catch (error) {
      console.error("Error getting all documents:", error);
      return [];
    }
  }
}