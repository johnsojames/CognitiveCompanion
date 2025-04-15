/**
 * Document Chunking Module
 * 
 * This module handles the splitting of documents into manageable chunks
 * for more effective retrieval in the RAG system.
 */

export interface ChunkMetadata {
  documentId: number;
  chunkIndex: number;
  totalChunks: number;
  startChar?: number;
  endChar?: number;
  title?: string;
  section?: string;
}

export interface DocumentChunk {
  id?: string;  // Generated unique ID for this chunk
  content: string;
  metadata: ChunkMetadata;
}

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  splitBySection?: boolean;
  minChunkSize?: number;
}

/**
 * Document Chunker class that handles various chunking strategies
 */
export class DocumentChunker {
  // Default chunk size (characters)
  private defaultChunkSize: number = 1000;
  
  // Default chunk overlap (characters)
  private defaultChunkOverlap: number = 200;
  
  // Minimum chunk size to avoid tiny chunks
  private defaultMinChunkSize: number = 100;
  
  /**
   * Splits a document into chunks based on specified strategy
   */
  splitDocument(
    documentId: number,
    content: string,
    options: ChunkingOptions = {}
  ): DocumentChunk[] {
    const {
      chunkSize = this.defaultChunkSize,
      chunkOverlap = this.defaultChunkOverlap,
      splitBySection = true,
      minChunkSize = this.defaultMinChunkSize
    } = options;
    
    // First attempt to split by sections if enabled
    if (splitBySection) {
      const sectionChunks = this.splitByNaturalSections(documentId, content, minChunkSize);
      
      // If sections produced reasonable chunks, use them
      if (sectionChunks.length > 1) {
        return sectionChunks;
      }
      // Otherwise fall back to fixed-size chunking
    }
    
    // Default to fixed-size chunking with overlap
    return this.splitByFixedSize(documentId, content, chunkSize, chunkOverlap);
  }
  
  /**
   * Splits text by natural section boundaries (headings, paragraphs)
   */
  private splitByNaturalSections(
    documentId: number,
    content: string,
    minChunkSize: number
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    // Detect markdown headings or clear paragraph breaks
    const sectionPattern = /(?:^|\n)(?:#{1,6} .+|\n\s*\n)/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    let currentSection = '';
    
    // Extract title from first line if possible
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : 'Untitled Document';
    
    // Find all section breaks
    while ((match = sectionPattern.exec(content)) !== null) {
      // If not at the start of the document, create a chunk from previous content
      if (match.index > lastIndex) {
        const sectionContent = content.substring(lastIndex, match.index).trim();
        
        // Only create a chunk if the content is substantial
        if (sectionContent.length >= minChunkSize) {
          chunks.push({
            content: sectionContent,
            metadata: {
              documentId,
              chunkIndex: chunks.length,
              totalChunks: 0, // Will update after all chunks are created
              startChar: lastIndex,
              endChar: match.index,
              title,
              section: currentSection
            }
          });
        }
      }
      
      // Update the current section title if this match is a heading
      if (match[0].trim().startsWith('#')) {
        currentSection = match[0].trim();
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add the final chunk after the last section break
    if (lastIndex < content.length) {
      const sectionContent = content.substring(lastIndex).trim();
      
      if (sectionContent.length >= minChunkSize) {
        chunks.push({
          content: sectionContent,
          metadata: {
            documentId,
            chunkIndex: chunks.length,
            totalChunks: 0,
            startChar: lastIndex,
            endChar: content.length,
            title,
            section: currentSection
          }
        });
      }
    }
    
    // Handle the case where no section breaks were found
    if (chunks.length === 0 && content.trim().length >= minChunkSize) {
      chunks.push({
        content: content.trim(),
        metadata: {
          documentId,
          chunkIndex: 0,
          totalChunks: 1,
          startChar: 0,
          endChar: content.length,
          title
        }
      });
    }
    
    // Update total chunks
    const totalChunks = chunks.length;
    chunks.forEach(chunk => {
      chunk.metadata.totalChunks = totalChunks;
    });
    
    return chunks;
  }
  
  /**
   * Splits text into fixed-size chunks with overlap
   */
  private splitByFixedSize(
    documentId: number,
    content: string,
    chunkSize: number,
    chunkOverlap: number
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const contentLength = content.length;
    
    // Extract title from first line if possible
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : 'Untitled Document';
    
    // Handle empty or very small documents
    if (contentLength <= chunkSize) {
      chunks.push({
        content,
        metadata: {
          documentId,
          chunkIndex: 0,
          totalChunks: 1,
          startChar: 0,
          endChar: contentLength,
          title
        }
      });
      return chunks;
    }
    
    // Create chunks with overlapping content
    let startIndex = 0;
    let chunkIndex = 0;
    
    while (startIndex < contentLength) {
      // Calculate the end index for this chunk
      let endIndex = Math.min(startIndex + chunkSize, contentLength);
      
      // Adjust to avoid breaking words
      if (endIndex < contentLength) {
        // Try to find a natural break point (whitespace)
        const breakPoint = content.lastIndexOf(' ', endIndex);
        if (breakPoint > startIndex) {
          endIndex = breakPoint + 1; // Include the space
        }
      }
      
      // Extract the chunk text
      const chunkContent = content.substring(startIndex, endIndex).trim();
      
      // Add the chunk
      chunks.push({
        content: chunkContent,
        metadata: {
          documentId,
          chunkIndex,
          totalChunks: 0, // Will update after all chunks are created
          startChar: startIndex,
          endChar: endIndex,
          title
        }
      });
      
      // Move to next chunk, accounting for overlap
      startIndex = endIndex - chunkOverlap;
      
      // Ensure we're making forward progress in case the overlap is too large
      if (startIndex <= chunks[chunks.length - 1].metadata.startChar!) {
        startIndex = endIndex;
      }
      
      chunkIndex++;
    }
    
    // Update total chunks
    const totalChunks = chunks.length;
    chunks.forEach(chunk => {
      chunk.metadata.totalChunks = totalChunks;
    });
    
    return chunks;
  }
  
  /**
   * Creates a unique ID for a chunk
   */
  generateChunkId(documentId: number, chunkIndex: number): string {
    return `doc_${documentId}_chunk_${chunkIndex}`;
  }
}

// Export a singleton instance
export const documentChunker = new DocumentChunker();