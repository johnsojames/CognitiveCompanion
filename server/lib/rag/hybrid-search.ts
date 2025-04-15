import { VectorStore } from '../vectorstore';
import { storage } from '../../storage';

// BM25 Parameters
const k1 = 1.2;  // Term frequency saturation
const b = 0.75;  // Document length normalization

interface DocumentIndex {
  [docId: number]: {
    terms: Map<string, number>,
    length: number
  }
}

/**
 * Hybrid search combining BM25 keyword search with vector embeddings
 */
export class HybridSearch {
  private vectorStore: VectorStore;
  private documentIndex: DocumentIndex = {};
  private termFreq: Map<string, number> = new Map();
  private avgDocLength: number = 0;
  private docCount: number = 0;
  private initialized: boolean = false;
  
  /**
   * Create a new hybrid search
   * @param vectorStore Vector store for embedding-based search
   */
  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
  }
  
  /**
   * Initialize the BM25 index
   * @param documents Document content to index
   */
  async initialize(documents: {id: number, content: string}[]): Promise<void> {
    if (this.initialized) return;
    
    try {
      this.documentIndex = {};
      this.termFreq = new Map();
      this.docCount = documents.length;
      let totalLength = 0;
      
      // Process each document
      for (const doc of documents) {
        const terms = this.tokenize(doc.content);
        const termFreq = new Map<string, number>();
        
        // Count term frequencies
        for (const term of terms) {
          termFreq.set(term, (termFreq.get(term) || 0) + 1);
          this.termFreq.set(term, (this.termFreq.get(term) || 0) + 1);
        }
        
        // Store document info
        this.documentIndex[doc.id] = {
          terms: termFreq,
          length: terms.length
        };
        
        totalLength += terms.length;
      }
      
      // Calculate average document length
      this.avgDocLength = this.docCount ? totalLength / this.docCount : 0;
      
      this.initialized = true;
      console.log(`BM25 index initialized with ${this.docCount} documents`);
      console.log(`Average document length: ${this.avgDocLength} terms`);
      console.log(`Vocabulary size: ${this.termFreq.size} terms`);
    } catch (error) {
      console.error("Error initializing BM25 index:", error);
    }
  }
  
  /**
   * Tokenize text into terms (words)
   * @param text Input text
   * @returns Array of terms
   */
  private tokenize(text: string): string[] {
    // Simplistic tokenization
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
      .split(/\s+/)              // Split on whitespace
      .filter(term => term.length > 2 && !this.isStopWord(term));  // Remove short terms and stop words
  }
  
  /**
   * Check if a term is a stop word
   * @param term Term to check
   * @returns True if stop word
   */
  private isStopWord(term: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'are', 'for', 'was', 'with', 'they', 'this', 'that', 'have',
      'from', 'not', 'but', 'what', 'all', 'were', 'when', 'where', 'who', 'will',
      'more', 'than', 'each', 'some', 'can', 'its', 'into'
    ]);
    
    return stopWords.has(term);
  }
  
  /**
   * Calculate BM25 score for a document and query
   * @param docId Document ID
   * @param queryTerms Query terms
   * @returns BM25 score
   */
  private calculateBM25Score(docId: number, queryTerms: string[]): number {
    if (!this.documentIndex[docId]) return 0;
    
    const docInfo = this.documentIndex[docId];
    let score = 0;
    
    for (const term of queryTerms) {
      const termFreqInDoc = docInfo.terms.get(term) || 0;
      if (termFreqInDoc === 0) continue;
      
      // Number of documents containing this term
      const docsWithTerm = this.termFreq.get(term) || 0;
      if (docsWithTerm === 0) continue;
      
      // IDF (Inverse Document Frequency)
      const idf = Math.log(1 + (this.docCount - docsWithTerm + 0.5) / (docsWithTerm + 0.5));
      
      // Term frequency normalized by document length
      const tf = termFreqInDoc / (1 - b + b * (docInfo.length / this.avgDocLength));
      
      // BM25 term contribution
      const termScore = idf * (tf * (k1 + 1)) / (tf + k1);
      score += termScore;
    }
    
    return score;
  }
  
  /**
   * Search using hybrid approach (BM25 + vector similarity)
   * @param query Search query
   * @param limit Maximum number of results
   * @param alpha Weight for BM25 scores (1-alpha = vector weight)
   * @returns Hybrid search results
   */
  async search(query: string, limit: number = 5, alpha: number = 0.3): Promise<any[]> {
    try {
      // Step 1: Vector search
      const vectorResults = await this.vectorStore.searchSimilarDocuments(query, limit * 2);
      
      // Step 2: BM25 search
      const queryTerms = this.tokenize(query);
      const bm25Scores = new Map<number, number>();
      
      // Calculate BM25 scores for all documents in the index
      for (const docId of Object.keys(this.documentIndex).map(Number)) {
        const score = this.calculateBM25Score(docId, queryTerms);
        if (score > 0) {
          bm25Scores.set(docId, score);
        }
      }
      
      // Convert to array and sort by score
      const bm25Results = Array.from(bm25Scores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit * 2);
      
      // Step 3: Combine results
      const hybridScores = new Map<number, number>();
      
      // Normalize BM25 scores
      const maxBM25 = Math.max(...bm25Results.map(r => r[1]), 0.001);
      for (const [id, score] of bm25Results) {
        hybridScores.set(id, (score / maxBM25) * alpha);
      }
      
      // Normalize and add vector scores
      const maxVector = Math.max(...vectorResults.map(r => r.score), 0.001);
      for (const result of vectorResults) {
        const normalizedVectorScore = (result.score / maxVector) * (1 - alpha);
        hybridScores.set(result.id, (hybridScores.get(result.id) || 0) + normalizedVectorScore);
      }
      
      // Sort and limit results
      const hybridResults = Array.from(hybridScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
      
      // Get document contents and information
      const documents = [];
      
      for (const [id, score] of hybridResults) {
        const document = await storage.getDocument(id);
        if (document) {
          const content = await this.vectorStore.getDocumentById(id);
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
      console.error("Error in hybrid search:", error);
      
      // Fall back to vector search
      console.log("Falling back to vector search only");
      return this.vectorStore.searchSimilarDocuments(query, limit);
    }
  }
}