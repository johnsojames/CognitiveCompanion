import fs from 'fs';
import path from 'path';
import { createVectorStore } from '../vectorstore';
import { storage } from '../../storage';

// Initialize vector store
const vectorStore = createVectorStore();

/**
 * Document processor for extracting content and vectorizing documents
 */
export class DocumentProcessor {
  /**
   * Process a document and vectorize it
   * @param documentId Document ID
   * @param filePath Path to the document file
   * @param fileType File type extension
   */
  async processDocument(documentId: number, filePath: string, fileType: string): Promise<void> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // Extract text content based on file type
      const content = await this.extractContent(filePath, fileType);
      
      if (!content) {
        throw new Error(`Failed to extract content from ${filePath}`);
      }
      
      // Add the document to the vector store
      await vectorStore.addDocument(documentId, content, {
        fileType,
        filePath
      });
      
      console.log(`Document ${documentId} processed and vectorized successfully`);
    } catch (error) {
      console.error(`Error processing document ${documentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Extract content from a document
   * @param filePath Path to the document file
   * @param fileType File type extension
   * @returns Document content
   */
  private async extractContent(filePath: string, fileType: string): Promise<string> {
    try {
      // Simple text-based extraction for now
      // In a full implementation, this would use libraries like pdf-parse for PDFs,
      // docx for Word documents, etc.
      
      switch (fileType.toLowerCase()) {
        case 'txt':
        case 'md':
        case 'js':
        case 'ts':
        case 'py':
        case 'json':
        case 'html':
        case 'css':
          return fs.readFileSync(filePath, 'utf-8');
          
        default:
          // For unsupported file types, just read as text and hope for the best
          try {
            return fs.readFileSync(filePath, 'utf-8');
          } catch (error) {
            console.error(`Unsupported file type: ${fileType}`);
            return `[Content of ${path.basename(filePath)} could not be extracted]`;
          }
      }
    } catch (error) {
      console.error(`Error extracting content from ${filePath}:`, error);
      return '';
    }
  }
  
  /**
   * Get document context for a given document
   * @param documentId Document ID
   * @param filePath Path to the document file
   * @returns Document context
   */
  async getDocumentContext(documentId: number, filePath: string): Promise<string> {
    try {
      // Try to get the content from the vector store
      const content = await vectorStore.getDocumentById(documentId);
      
      if (content) {
        return `DOCUMENT: ${path.basename(filePath)}\n${content}`;
      }
      
      // If not in vector store, try to read from file
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return `DOCUMENT: ${path.basename(filePath)}\n${fileContent}`;
      }
      
      return `[Document ${path.basename(filePath)} not found]`;
    } catch (error) {
      console.error(`Error getting document context for ${documentId}:`, error);
      return `[Error retrieving document content]`;
    }
  }
  
  /**
   * Search for documents matching a query
   * @param query Search query
   * @param limit Maximum number of results
   * @returns Search results
   */
  async searchDocuments(query: string, limit: number = 5): Promise<any[]> {
    try {
      // Search using vector similarity
      const searchResults = await vectorStore.searchSimilarDocuments(query, limit);
      
      // Get full documents
      const documents = await Promise.all(
        searchResults.map(async (result) => {
          const document = await storage.getDocument(result.id);
          return {
            ...document,
            score: result.score
          };
        })
      );
      
      return documents.filter(doc => doc !== undefined);
    } catch (error) {
      console.error("Error searching documents:", error);
      return [];
    }
  }
}