import { storage } from "../../storage";
import { MemoryEntry } from "@shared/schema";

/**
 * Personalization manager that adjusts AI responses based on user history
 */
export class PersonalizationManager {
  /**
   * Generates a personalized context for LLM prompts
   * @param userId The user ID to personalize for
   * @param conversationId Current conversation ID
   * @returns A personalized context string to add to prompts
   */
  async generatePersonalizedContext(userId: number, conversationId: number): Promise<string> {
    try {
      // Get all memory entries for this user
      const allMemoryEntries = await this.getUserMemoryEntries(userId);
      
      // Get conversation-specific entries
      const conversationEntries = allMemoryEntries.filter(
        entry => entry.conversationId === conversationId
      );
      
      // Get user preference entries
      const preferenceEntries = allMemoryEntries.filter(
        entry => entry.type === 'preference'
      );
      
      // Sort and limit entries based on importance and recency
      const sortedEntries = this.prioritizeMemoryEntries(allMemoryEntries);
      const limitedEntries = sortedEntries.slice(0, 10); // Limit to most important 10 entries
      
      // Generate context string
      let context = "## User Personalization\n";
      
      // Add preferences
      if (preferenceEntries.length > 0) {
        context += "\nUser preferences:\n";
        for (const entry of preferenceEntries) {
          context += `- ${this.formatKey(entry.key)}: ${entry.value}\n`;
        }
      }
      
      // Add other important insights
      const insights = limitedEntries.filter(entry => entry.type === 'insight');
      if (insights.length > 0) {
        context += "\nImportant insights about the user:\n";
        for (const entry of insights) {
          context += `- ${this.formatKey(entry.key)}: ${entry.value}\n`;
        }
      }
      
      // Add conversation-specific context
      if (conversationEntries.length > 0) {
        context += "\nRelevant to current conversation:\n";
        for (const entry of conversationEntries) {
          context += `- ${this.formatKey(entry.key)}: ${entry.value}\n`;
        }
      }
      
      return context;
    } catch (error) {
      console.error("Error generating personalized context:", error);
      return ""; // Return empty string on error
    }
  }
  
  /**
   * Prioritizes memory entries based on importance, recency and type
   * @param entries Memory entries to prioritize
   * @returns Sorted array of entries
   */
  private prioritizeMemoryEntries(entries: MemoryEntry[]): MemoryEntry[] {
    return entries.sort((a, b) => {
      // Calculate a score based on importance and recency
      const scoreA = this.calculateEntryScore(a);
      const scoreB = this.calculateEntryScore(b);
      return scoreB - scoreA; // Higher score first
    });
  }
  
  /**
   * Calculate a score for an entry based on its properties
   * @param entry The memory entry to score
   * @returns A numeric score (higher = more important)
   */
  private calculateEntryScore(entry: MemoryEntry): number {
    // Base score is the importance value
    let score = entry.importance || 1;
    
    // Adjust based on recency (newer entries get higher score)
    const ageInDays = this.getAgeInDays(entry.lastUpdated);
    // Decay factor - reduce score by 10% for each 7 days
    const recencyFactor = Math.pow(0.9, ageInDays / 7);
    
    // Adjust based on type
    const typeMultiplier = this.getTypeMultiplier(entry.type);
    
    // Combine factors
    return score * recencyFactor * typeMultiplier;
  }
  
  /**
   * Calculate age of an entry in days
   * @param dateString Date string to calculate age from
   * @returns Age in days
   */
  private getAgeInDays(dateString: string): number {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return diffMs / (1000 * 60 * 60 * 24);
  }
  
  /**
   * Get multiplier based on memory entry type
   * @param type Entry type
   * @returns Multiplier value
   */
  private getTypeMultiplier(type: string): number {
    switch (type) {
      case 'preference':
        return 1.5; // Preferences are most important
      case 'insight':
        return 1.2; // Insights are important
      case 'summary':
        return 1.0; // Summaries are baseline
      default:
        return 1.0;
    }
  }
  
  /**
   * Format key string for display
   * @param key Key to format
   * @returns Formatted key
   */
  private formatKey(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }
  
  /**
   * Get all memory entries for a user
   * @param userId User ID
   * @returns Array of memory entries
   */
  private async getUserMemoryEntries(userId: number): Promise<MemoryEntry[]> {
    return await storage.getMemoryEntriesByUserId(userId);
  }
  
  /**
   * Extracts and stores user vocabulary patterns
   * @param userId User ID
   * @param text Text to analyze for vocabulary patterns
   */
  async learnVocabularyPatterns(userId: number, text: string): Promise<void> {
    try {
      // Simple implementation - extract uncommon words and phrases
      const words = text.split(/\s+/);
      
      // Filter for uncommon words (6+ characters)
      const uncommonWords = words.filter(word => {
        const cleaned = word.replace(/[^\w]/g, '');
        return cleaned.length >= 6; // Words with 6+ characters might be domain-specific
      });
      
      // Count word frequencies
      const wordFrequency: Record<string, number> = {};
      uncommonWords.forEach(word => {
        const normalized = word.toLowerCase().replace(/[^\w]/g, '');
        if (normalized) {
          wordFrequency[normalized] = (wordFrequency[normalized] || 0) + 1;
        }
      });
      
      // Store frequent words as vocabulary preferences
      for (const [word, count] of Object.entries(wordFrequency)) {
        if (count >= 2) { // Word appeared at least twice
          // Check if we already have this word
          const existingEntry = await storage.getMemoryEntryByKey(
            userId, 
            `vocabulary_${word}`,
            'vocabulary'
          );
          
          if (existingEntry) {
            // Update count
            const newCount = parseInt(existingEntry.value) + count;
            await storage.updateMemoryEntry(existingEntry.id, newCount.toString());
          } else {
            // Create new entry
            await storage.createMemoryEntry({
              userId,
              conversationId: null,
              type: 'vocabulary',
              key: `vocabulary_${word}`,
              value: count.toString(),
              importance: 3 // Low importance by default
            });
          }
        }
      }
    } catch (error) {
      console.error("Error learning vocabulary patterns:", error);
    }
  }
  
  /**
   * Generate vocabulary context based on user's frequent terms
   * @param userId User ID
   * @returns Context string with vocabulary preferences
   */
  async getVocabularyContext(userId: number): Promise<string> {
    try {
      // Get vocabulary entries
      const vocabularyEntries = await storage.getMemoryEntriesByUserId(userId, 'vocabulary');
      
      // Sort by frequency (value)
      const sortedEntries = vocabularyEntries.sort((a, b) => {
        return parseInt(b.value) - parseInt(a.value);
      }).slice(0, 15); // Top 15 terms
      
      if (sortedEntries.length === 0) return "";
      
      let context = "## User Vocabulary Preferences\n";
      context += "The user frequently uses these specialized terms:\n";
      
      for (const entry of sortedEntries) {
        const term = entry.key.replace('vocabulary_', '');
        context += `- ${term} (${entry.value} occurrences)\n`;
      }
      
      return context;
    } catch (error) {
      console.error("Error generating vocabulary context:", error);
      return "";
    }
  }
}

export const personalizationManager = new PersonalizationManager();