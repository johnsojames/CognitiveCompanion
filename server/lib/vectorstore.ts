import { Document } from "@shared/schema";
import * as fs from 'fs';
import * as path from 'path';

// Simple vector store interface
export interface VectorStore {
  addDocument(documentId: number, text: string): Promise<void>;
  searchSimilarDocuments(query: string, limit: number): Promise<Array<{id: number, score: number}>>;
  getDocumentById(id: number): Promise<string | null>;
}

// In-memory vector store implementation
export class InMemoryVectorStore implements VectorStore {
  private documents: Map<number, string> = new Map();
  
  async addDocument(documentId: number, text: string): Promise<void> {
    this.documents.set(documentId, text);
  }
  
  async searchSimilarDocuments(query: string, limit: number): Promise<Array<{id: number, score: number}>> {
    // Simple keyword search in the absence of real vector similarity
    const results: Array<{id: number, score: number}> = [];
    
    for (const [id, text] of this.documents.entries()) {
      // Calculate a simple relevance score based on term frequency
      const queryTerms = query.toLowerCase().split(/\s+/);
      let score = 0;
      
      for (const term of queryTerms) {
        if (term.length < 3) continue; // Skip short terms
        
        const regex = new RegExp(term, 'gi');
        const matches = text.match(regex);
        if (matches) {
          score += matches.length;
        }
      }
      
      if (score > 0) {
        results.push({ id, score });
      }
    }
    
    // Sort by score and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  async getDocumentById(id: number): Promise<string | null> {
    return this.documents.get(id) || null;
  }
}

// Factory function to create vector store
export function createVectorStore(type: string = 'memory'): VectorStore {
  switch (type) {
    case 'memory':
    default:
      return new InMemoryVectorStore();
  }
}

// Singleton instance
const vectorStore = createVectorStore();
export default vectorStore;
