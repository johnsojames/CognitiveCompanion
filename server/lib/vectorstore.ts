import { Document } from "@shared/schema";
import * as fs from 'fs';
import * as path from 'path';
import pkg from 'pg';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Database configuration
const pool = new pkg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Simple vector store interface
export interface VectorStore {
  addDocument(documentId: number, text: string): Promise<void>;
  searchSimilarDocuments(query: string, limit: number): Promise<Array<{id: number, score: number}>>;
  getDocumentById(id: number): Promise<string | null>;
}

// Helper function to generate embeddings using OpenAI
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // For large texts, truncate to avoid token limits
    const truncatedText = text.slice(0, 8000);
    
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: truncatedText,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate embedding");
  }
}

// In-memory vector store implementation (fallback)
export class InMemoryVectorStore implements VectorStore {
  private documents: Map<number, string> = new Map();
  
  async addDocument(documentId: number, text: string): Promise<void> {
    this.documents.set(documentId, text);
  }
  
  async searchSimilarDocuments(query: string, limit: number): Promise<Array<{id: number, score: number}>> {
    // Simple keyword search in the absence of real vector similarity
    const results: Array<{id: number, score: number}> = [];
    
    // Convert Map entries to array for compatibility
    const entries = Array.from(this.documents.entries());
    
    for (let i = 0; i < entries.length; i++) {
      const [id, text] = entries[i];
      
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

// Define types for database rows
interface DocumentVectorRow {
  document_id: number;
  content: string;
  similarity?: number;
  rank?: number;
}

// PgVector store implementation
export class PgVectorStore implements VectorStore {
  constructor(private pool: any) {}
  
  async addDocument(documentId: number, text: string): Promise<void> {
    try {
      // Generate embedding for the document
      const embedding = await generateEmbedding(text);
      
      // Insert document and embedding into database
      await this.pool.query(
        'INSERT INTO document_vectors (document_id, content, embedding) VALUES ($1, $2, $3)',
        [documentId, text, embedding]
      );
      
      console.log(`Document ${documentId} added to vector store`);
    } catch (error) {
      console.error("Error adding document to vector store:", error);
      throw new Error("Failed to add document to vector store");
    }
  }
  
  async searchSimilarDocuments(query: string, limit: number): Promise<Array<{id: number, score: number}>> {
    try {
      // Generate embedding for query
      const queryEmbedding = await generateEmbedding(query);
      
      // Search for similar documents using cosine similarity
      const result = await this.pool.query(
        `SELECT document_id, 1 - (embedding <=> $1) as similarity 
         FROM document_vectors 
         ORDER BY similarity DESC 
         LIMIT $2`,
        [queryEmbedding, limit]
      );
      
      // Format results
      return result.rows.map((row: DocumentVectorRow) => ({
        id: row.document_id,
        score: row.similarity || 0
      }));
    } catch (error) {
      console.error("Error searching similar documents:", error);
      // Fallback to a simple search if embedding fails
      return this.fallbackSearch(query, limit);
    }
  }
  
  async getDocumentById(id: number): Promise<string | null> {
    try {
      const result = await this.pool.query(
        'SELECT content FROM document_vectors WHERE document_id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0].content;
    } catch (error) {
      console.error("Error retrieving document:", error);
      return null;
    }
  }
  
  // Fallback search method using simple text matching
  private async fallbackSearch(query: string, limit: number): Promise<Array<{id: number, score: number}>> {
    try {
      // Use basic text search as fallback
      const result = await this.pool.query(
        `SELECT document_id, ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) as rank 
         FROM document_vectors 
         WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
         ORDER BY rank DESC 
         LIMIT $2`,
        [query, limit]
      );
      
      return result.rows.map((row: DocumentVectorRow) => ({
        id: row.document_id,
        score: row.rank || 0
      }));
    } catch (error) {
      console.error("Error in fallback search:", error);
      return [];
    }
  }
}

// Factory function to create vector store
export function createVectorStore(type: string = 'postgres'): VectorStore {
  switch (type) {
    case 'postgres':
      // Check if DATABASE_URL is available
      if (process.env.DATABASE_URL) {
        console.log("Using PostgreSQL vector store");
        return new PgVectorStore(pool);
      } else {
        console.warn("DATABASE_URL not found, falling back to in-memory store");
        return new InMemoryVectorStore();
      }
    case 'memory':
      console.log("Using in-memory vector store");
      return new InMemoryVectorStore();
    default:
      console.log("Unknown vector store type, using in-memory store");
      return new InMemoryVectorStore();
  }
}

// Singleton instance
const vectorStore = createVectorStore();
export default vectorStore;
