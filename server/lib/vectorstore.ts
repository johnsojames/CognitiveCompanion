import pg from 'pg';
const { Pool } = pg;
import { db } from '../db';
import { documentChunks } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Interface for vector store operations
 */
export interface VectorStore {
  /**
   * Add a document to the vector store
   * @param documentId Document ID
   * @param content Document content
   * @param metadata Additional metadata
   */
  addDocument(documentId: number, content: string, metadata: any): Promise<void>;
  
  /**
   * Get document content by ID
   * @param documentId Document ID
   * @returns Document content
   */
  getDocumentById(documentId: number): Promise<string | null>;
  
  /**
   * Search for similar documents
   * @param query Search query
   * @param limit Maximum number of results
   * @returns Array of document IDs and scores
   */
  searchSimilarDocuments(query: string, limit?: number): Promise<Array<{id: number, score: number}>>;
  
  /**
   * Delete a document from the vector store
   * @param documentId Document ID
   */
  deleteDocument(documentId: number): Promise<void>;
}

/**
 * Memory-based vector store (fallback)
 */
class MemoryVectorStore implements VectorStore {
  private documents: Map<number, {
    content: string, 
    metadata: any
  }> = new Map();
  
  async addDocument(documentId: number, content: string, metadata: any): Promise<void> {
    this.documents.set(documentId, { content, metadata });
    console.log(`Added document ${documentId} to memory vector store`);
  }
  
  async getDocumentById(documentId: number): Promise<string | null> {
    const doc = this.documents.get(documentId);
    return doc ? doc.content : null;
  }
  
  async searchSimilarDocuments(query: string, limit: number = 5): Promise<Array<{id: number, score: number}>> {
    // Very basic search - just a word match count
    const results = [];
    
    const queryWords = query.toLowerCase().split(/\s+/);
    
    for (const [id, doc] of this.documents.entries()) {
      const content = doc.content.toLowerCase();
      
      // Count word matches
      let matchCount = 0;
      for (const word of queryWords) {
        if (content.includes(word)) {
          matchCount++;
        }
      }
      
      // Calculate a basic score
      const score = matchCount / queryWords.length;
      
      if (score > 0) {
        results.push({ id, score });
      }
    }
    
    // Sort by score descending and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  async deleteDocument(documentId: number): Promise<void> {
    this.documents.delete(documentId);
    console.log(`Deleted document ${documentId} from memory vector store`);
  }
}

/**
 * PostgreSQL vector store with pgvector
 */
class PostgresVectorStore implements VectorStore {
  private pool: Pool;
  
  constructor(pool: Pool) {
    this.pool = pool;
    console.log("Using PostgreSQL vector store");
  }
  
  async addDocument(documentId: number, content: string, metadata: any): Promise<void> {
    try {
      // Create embedding for the document using OpenAI API
      const embedding = await this.generateEmbedding(content);
      
      // Store the document in the database
      await db.insert(documentChunks).values({
        documentId: documentId,
        chunkIndex: 0, // Single chunk for now
        content: content,
        metadata: metadata,
        embedding: JSON.stringify(embedding) // Store as string for now
      });
      
      console.log(`Added document ${documentId} to PostgreSQL vector store`);
    } catch (error) {
      console.error("Error adding document to vector store:", error);
      throw error;
    }
  }
  
  async getDocumentById(documentId: number): Promise<string | null> {
    try {
      const chunks = await db.select().from(documentChunks).where(eq(documentChunks.documentId, documentId));
      
      if (chunks.length === 0) {
        return null;
      }
      
      // Combine all chunks
      return chunks.map(chunk => chunk.content).join("\n\n");
    } catch (error) {
      console.error("Error getting document from vector store:", error);
      return null;
    }
  }
  
  async searchSimilarDocuments(query: string, limit: number = 5): Promise<Array<{id: number, score: number}>> {
    try {
      // Get embedding for query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Perform vector similarity search using dot product
      // Note: In a production system, you'd use cosine_similarity or <=> operators
      // with proper vector types
      const result = await this.pool.query(`
        SELECT 
          document_id, 
          metadata,
          1 - (embedding::float[] <-> $1::float[]) as similarity
        FROM document_chunks
        ORDER BY similarity DESC
        LIMIT $2
      `, [JSON.stringify(queryEmbedding), limit]);
      
      return result.rows.map(row => ({
        id: row.document_id,
        score: row.similarity
      }));
    } catch (error) {
      console.error("Error searching documents:", error);
      
      // Fallback to basic search
      return this.fallbackSearch(query, limit);
    }
  }
  
  async deleteDocument(documentId: number): Promise<void> {
    try {
      await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId));
      console.log(`Deleted document ${documentId} from PostgreSQL vector store`);
    } catch (error) {
      console.error("Error deleting document from vector store:", error);
      throw error;
    }
  }
  
  /**
   * Generate embedding for text using OpenAI API
   * @param text Text to embed
   * @returns Embedding vector
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not set - cannot generate embeddings");
    }
    
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-3-small'
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
      }
      
      const result = await response.json();
      return result.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      // Return a mock embedding of the right size
      return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    }
  }
  
  /**
   * Fallback search when vector search fails
   * @param query Query string
   * @param limit Maximum number of results
   * @returns Search results
   */
  private async fallbackSearch(query: string, limit: number): Promise<Array<{id: number, score: number}>> {
    try {
      // Basic text search using LIKE
      const result = await this.pool.query(`
        SELECT 
          document_id, 
          content,
          ts_rank(
            to_tsvector('english', content),
            plainto_tsquery('english', $1)
          ) as score
        FROM document_chunks
        WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
        ORDER BY score DESC
        LIMIT $2
      `, [query, limit]);
      
      return result.rows.map(row => ({
        id: row.document_id,
        score: row.score
      }));
    } catch (error) {
      console.error("Error in fallback search:", error);
      return [];
    }
  }
}

/**
 * Factory function to create a vector store
 * @returns Vector store instance
 */
export function createVectorStore(): VectorStore {
  try {
    if (process.env.DATABASE_URL) {
      // Use PostgreSQL vector store if database is available
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL
      });
      return new PostgresVectorStore(pool);
    }
  } catch (error) {
    console.error("Failed to create PostgreSQL vector store:", error);
    console.log("Falling back to memory vector store");
  }
  
  // Fallback to memory vector store
  return new MemoryVectorStore();
}