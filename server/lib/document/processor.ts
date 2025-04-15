import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import vectorStore from '../vectorstore';

const readFile = util.promisify(fs.readFile);

export class DocumentProcessor {
  // Process a document and add it to the vector store
  async processDocument(documentId: number, filePath: string, fileType: string): Promise<void> {
    try {
      const content = await this.extractText(filePath, fileType);
      await vectorStore.addDocument(documentId, content);
      return;
    } catch (error) {
      console.error(`Error processing document ${documentId}:`, error);
      throw new Error(`Failed to process document: ${error.message}`);
    }
  }
  
  // Extract text content from a document based on file type
  private async extractText(filePath: string, fileType: string): Promise<string> {
    try {
      // For simplicity, we're just reading text files directly
      // In a real implementation, you'd want to use libraries for PDF, DOCX, etc.
      const content = await readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      console.error(`Error extracting text from ${filePath}:`, error);
      throw new Error(`Failed to extract text: ${error.message}`);
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
        const content = await readFile(filePath, 'utf8');
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
}
