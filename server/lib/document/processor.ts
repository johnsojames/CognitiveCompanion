import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import vectorStore from '../vectorstore';
import { documentChunker } from './chunker';
import { db, pool } from '../../db';
import { documentChunks, documents, InsertDocumentChunk } from '@shared/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

// Initialize OpenAI client for embeddings
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class DocumentProcessor {
  // Generate embedding for a text chunk
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Truncate text to avoid token limits
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
  
  // Process a document by chunking and adding to vector store
  async processDocument(documentId: number, filePath: string, fileType: string): Promise<void> {
    try {
      console.log(`Processing document ${documentId} (${fileType}) at ${filePath}`);
      
      // Extract full text content
      const content = await this.extractText(filePath, fileType);
      
      if (!content) {
        throw new Error("Failed to extract content from document");
      }
      
      // Split document into chunks
      const chunks = documentChunker.splitDocument(documentId, content);
      console.log(`Document split into ${chunks.length} chunks`);
      
      // Process each chunk and store in database
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          // Generate embedding
          const embedding = await this.generateEmbedding(chunk.content);
          
          // Store chunk in database
          await db.insert(documentChunks).values({
            documentId: chunk.metadata.documentId,
            chunkIndex: chunk.metadata.chunkIndex,
            content: chunk.content,
            metadata: chunk.metadata,
            embedding: JSON.stringify(embedding)
          });
          
          console.log(`Processed chunk ${i+1}/${chunks.length} for document ${documentId}`);
        } catch (error) {
          console.error(`Error processing chunk ${i+1}/${chunks.length}:`, error);
        }
      }
      
      // Mark document as vectorized
      await db.update(documents)
        .set({ vectorized: true })
        .where(eq(documents.id, documentId));
      
      console.log(`Document ${documentId} successfully processed and added to database`);
      
      return;
    } catch (error) {
      console.error(`Error processing document ${documentId}:`, error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Extract text content from a document based on file type
  private async extractText(filePath: string, fileType: string): Promise<string> {
    try {
      // Make sure file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // Check file stats
      const fileStats = await stat(filePath);
      if (!fileStats.isFile()) {
        throw new Error(`Not a file: ${filePath}`);
      }
      
      // Handle different file types
      switch (fileType.toLowerCase()) {
        case 'txt':
        case 'md':
        case 'csv':
        case 'json':
        case 'js':
        case 'ts':
        case 'jsx':
        case 'tsx':
        case 'html':
        case 'css':
        case 'xml':
          // Text files can be read directly
          return await readFile(filePath, 'utf8');
          
        default:
          // For unsupported file types, just read as text and hope for the best
          console.warn(`Unsupported file type: ${fileType}, attempting to read as text`);
          return await readFile(filePath, 'utf8');
      }
    } catch (error) {
      console.error(`Error extracting text from ${filePath}:`, error);
      throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Get document context for a query
  async getDocumentContext(documentId: number, filePath: string): Promise<string> {
    try {
      // Check if document is in vector store
      const storedContent = await vectorStore.getDocumentById(documentId);
      
      if (storedContent) {
        return storedContent;
      }
      
      // If not in vector store, try to read from file
      if (fs.existsSync(filePath)) {
        // Determine file type from extension
        const fileExt = path.extname(filePath).substring(1);
        const content = await this.extractText(filePath, fileExt);
        
        // Also add to vector store for future use
        try {
          await vectorStore.addDocument(documentId, content);
        } catch (error) {
          console.warn(`Failed to add document ${documentId} to vector store:`, error);
        }
        
        return content;
      }
      
      return '';
    } catch (error) {
      console.error(`Error getting document context for ${documentId}:`, error);
      return '';
    }
  }
  
  // Search for relevant documents based on a query
  async searchRelevantDocuments(query: string, limit: number = 3): Promise<Array<{id: number, score: number}>> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // First try to search in the database (pgvector)
      try {
        // Convert embedding to string
        const embeddingStr = JSON.stringify(queryEmbedding);
        
        // Execute the search query using the pool directly for raw SQL
        const results = await pool.query(
          `SELECT document_id, 1 - (embedding::float8[]::vector <=> $1::float8[]::vector) as similarity 
           FROM document_chunks 
           ORDER BY similarity DESC 
           LIMIT $2`,
          [embeddingStr, limit]
        );
        
        if (results.rows && results.rows.length > 0) {
          return results.rows.map((row: any) => ({
            id: row.document_id,
            score: row.similarity
          }));
        }
      } catch (dbError) {
        console.error("Error searching in database:", dbError);
      }
      
      // Fallback to vector store
      return await vectorStore.searchSimilarDocuments(query, limit);
    } catch (error) {
      console.error(`Error searching documents for "${query}":`, error);
      return [];
    }
  }
  
  // Create uploads directory if it doesn't exist
  async ensureUploadsDirectory(): Promise<void> {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    try {
      await fs.promises.access(uploadsDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.promises.mkdir(uploadsDir, { recursive: true });
      console.log(`Created uploads directory at ${uploadsDir}`);
    }
  }
}
