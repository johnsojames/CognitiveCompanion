import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import vectorStore from '../vectorstore';

const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

export class DocumentProcessor {
  // Process a document and add it to the vector store
  async processDocument(documentId: number, filePath: string, fileType: string): Promise<void> {
    try {
      console.log(`Processing document ${documentId} (${fileType}) at ${filePath}`);
      
      const content = await this.extractText(filePath, fileType);
      
      if (!content) {
        throw new Error("Failed to extract content from document");
      }
      
      // Add document to vector store
      await vectorStore.addDocument(documentId, content);
      console.log(`Document ${documentId} successfully processed and added to vector store`);
      
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
