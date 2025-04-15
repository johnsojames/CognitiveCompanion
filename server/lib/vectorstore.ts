import fs from 'fs';
import { Pool } from '@neondatabase/serverless';
import { db, pool } from '../db';

/**
 * Search result from vector store
 */
export interface VectorSearchResult {
  id: number;
  score: number;
}

/**
 * Vector store for document embeddings
 */
export interface VectorStore {
  /**
   * Add a document to the vector store
   * @param id Document ID
   * @param content Document content
   * @param metadata Optional metadata
   */
  addDocument(id: number, content: string, metadata?: Record<string, any>): Promise<void>;
  
  /**
   * Search for similar documents
   * @param query Query text
   * @param limit Maximum number of results
   * @returns Search results with scores
   */
  searchSimilarDocuments(query: string, limit?: number): Promise<VectorSearchResult[]>;
  
  /**
   * Get document content by ID
   * @param id Document ID
   * @returns Document content
   */
  getDocumentById(id: number): Promise<string | null>;
  
  /**
   * Remove a document from the vector store
   * @param id Document ID
   */
  removeDocument(id: number): Promise<void>;
}

/**
 * PostgreSQL-based vector store that uses pgvector
 */
class PostgresVectorStore implements VectorStore {
  private pool: Pool;
  private openaiApiKey: string | undefined;
  
  constructor(pool: Pool) {
    this.pool = pool;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.initialize();
  }
  
  /**
   * Initialize the vector store by creating necessary tables and extensions
   */
  private async initialize(): Promise<void> {
    try {
      // Create pgvector extension if it doesn't exist
      await this.pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
      
      // Create documents table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS document_vectors (
          id INT PRIMARY KEY,
          content TEXT NOT NULL,
          metadata JSONB,
          embedding vector(1536),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      console.log('Using PostgreSQL vector store');
    } catch (error) {
      console.error("Error initializing PostgreSQL vector store:", error);
    }
  }
  
  /**
   * Generate an embedding for text using OpenAI
   * @param text Text to embed
   * @returns Embedding vector
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openaiApiKey) {
      throw new Error("OpenAI API key not set");
    }
    
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`
        },
        body: JSON.stringify({
          input: text.slice(0, 8000), // OpenAI has a token limit
          model: 'text-embedding-3-small'
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      return result.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw error;
    }
  }
  
  /**
   * Add a document to the vector store
   * @param id Document ID
   * @param content Document content
   * @param metadata Optional metadata
   */
  async addDocument(id: number, content: string, metadata?: Record<string, any>): Promise<void> {
    try {
      // Generate embedding
      const embedding = await this.generateEmbedding(content);
      
      // Insert or update document in the database
      await this.pool.query(`
        INSERT INTO document_vectors (id, content, metadata, embedding)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE 
        SET content = $2, metadata = $3, embedding = $4
      `, [id, content, metadata ? JSON.stringify(metadata) : null, embedding]);
      
      console.log(`Document ${id} added to vector store`);
    } catch (error) {
      console.error(`Error adding document ${id} to vector store:`, error);
      throw error;
    }
  }
  
  /**
   * Search for similar documents
   * @param query Query text
   * @param limit Maximum number of results (default 5)
   * @returns Search results with scores
   */
  async searchSimilarDocuments(query: string, limit: number = 5): Promise<VectorSearchResult[]> {
    try {
      // Generate embedding for the query
      const embedding = await this.generateEmbedding(query);
      
      // Search for similar documents using cosine similarity
      const result = await this.pool.query(`
        SELECT id, 1 - (embedding <=> $1) as score
        FROM document_vectors
        ORDER BY embedding <=> $1
        LIMIT $2
      `, [embedding, limit]);
      
      return result.rows.map(row => ({
        id: row.id,
        score: row.score
      }));
    } catch (error) {
      console.error("Error searching similar documents:", error);
      return [];
    }
  }
  
  /**
   * Get document content by ID
   * @param id Document ID
   * @returns Document content
   */
  async getDocumentById(id: number): Promise<string | null> {
    try {
      const result = await this.pool.query(`
        SELECT content FROM document_vectors WHERE id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0].content;
    } catch (error) {
      console.error(`Error getting document ${id}:`, error);
      return null;
    }
  }
  
  /**
   * Remove a document from the vector store
   * @param id Document ID
   */
  async removeDocument(id: number): Promise<void> {
    try {
      await this.pool.query(`
        DELETE FROM document_vectors WHERE id = $1
      `, [id]);
      
      console.log(`Document ${id} removed from vector store`);
    } catch (error) {
      console.error(`Error removing document ${id} from vector store:`, error);
      throw error;
    }
  }
}

/**
 * In-memory vector store for development and testing
 */
class MemoryVectorStore implements VectorStore {
  private documents: Map<number, { content: string, metadata?: Record<string, any> }> = new Map();
  
  /**
   * Add a document to the vector store
   * @param id Document ID
   * @param content Document content
   * @param metadata Optional metadata
   */
  async addDocument(id: number, content: string, metadata?: Record<string, any>): Promise<void> {
    this.documents.set(id, { content, metadata });
  }
  
  /**
   * Search for similar documents
   * Very simple keyword matching for demo purposes
   * @param query Query text
   * @param limit Maximum number of results
   * @returns Search results with scores
   */
  async searchSimilarDocuments(query: string, limit: number = 5): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];
    const queryWords = query.toLowerCase().split(/\s+/);
    
    // Simple term frequency scoring
    this.documents.forEach((doc, id) => {
      const content = doc.content.toLowerCase();
      let score = 0;
      
      for (const word of queryWords) {
        if (content.includes(word)) {
          score += 1;
        }
      }
      
      if (score > 0) {
        results.push({ id, score: score / queryWords.length });
      }
    });
    
    // Sort by score descending and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  /**
   * Get document content by ID
   * @param id Document ID
   * @returns Document content
   */
  async getDocumentById(id: number): Promise<string | null> {
    const doc = this.documents.get(id);
    return doc ? doc.content : null;
  }
  
  /**
   * Remove a document from the vector store
   * @param id Document ID
   */
  async removeDocument(id: number): Promise<void> {
    this.documents.delete(id);
  }
}

/**
 * Create a vector store based on environment
 * @returns Vector store implementation
 */
export function createVectorStore(): VectorStore {
  // Use PostgreSQL if connected
  if (pool) {
    return new PostgresVectorStore(pool);
  }
  
  // Fallback to memory store (for development)
  console.log('Using in-memory vector store (no database connection)');
  return new MemoryVectorStore();
}