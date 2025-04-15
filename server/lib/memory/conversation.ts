import { storage } from '../../storage';
import { personalizationManager } from '../learning/personalization';

/**
 * Manages conversation memory and context
 */
export class ConversationMemory {
  /**
   * Save a conversation summary to memory
   * @param userId User ID
   * @param conversationId Conversation ID
   */
  async saveConversationSummary(userId: number, conversationId: number): Promise<void> {
    try {
      // Generate a summary of the conversation
      const summary = await personalizationManager.generateConversationSummary(conversationId);
      
      if (!summary) return;
      
      // Save the summary as a memory entry
      await storage.createMemoryEntry({
        userId,
        conversationId,
        type: 'summary',
        key: `conversation_${conversationId}`,
        value: summary,
        importance: 3 // Medium importance
      });
      
      console.log(`Saved summary for conversation ${conversationId}`);
    } catch (error) {
      console.error("Error saving conversation summary:", error);
    }
  }
  
  /**
   * Save an insight about the user based on conversation
   * @param userId User ID
   * @param conversationId Conversation ID
   * @param insight Insight text
   * @param importance Importance score (1-10)
   */
  async saveUserInsight(
    userId: number, 
    conversationId: number | null, 
    insight: string, 
    importance: number = 5
  ): Promise<void> {
    try {
      // Generate a key based on the insight text
      // Use first 5 words as a key
      const words = insight.split(/\s+/).slice(0, 5).join('_');
      const key = `insight_${words}`;
      
      // Check if a similar insight already exists
      const existingInsight = await storage.getMemoryEntryByKey(userId, key, 'insight');
      
      if (existingInsight) {
        // Update the existing insight with increased importance
        await storage.updateMemoryEntry(
          existingInsight.id,
          insight, // Use the new insight text
          Math.min(10, (existingInsight.importance || 5) + 1) // Increase importance but cap at 10
        );
      } else {
        // Create a new insight
        await storage.createMemoryEntry({
          userId,
          conversationId,
          type: 'insight',
          key,
          value: insight,
          importance
        });
      }
    } catch (error) {
      console.error("Error saving user insight:", error);
    }
  }
  
  /**
   * Save a user preference
   * @param userId User ID
   * @param category Preference category
   * @param value Preference value
   * @param importance Importance score (1-10)
   */
  async saveUserPreference(
    userId: number,
    category: string,
    value: string,
    importance: number = 5
  ): Promise<void> {
    try {
      // Check if preference already exists
      const existingPreference = await storage.getMemoryEntryByKey(userId, category, 'preference');
      
      if (existingPreference) {
        // Update existing preference
        await storage.updateMemoryEntry(
          existingPreference.id,
          value,
          Math.min(10, (existingPreference.importance || 5) + 1) // Increase importance but cap at 10
        );
      } else {
        // Create new preference
        await storage.createMemoryEntry({
          userId,
          type: 'preference',
          key: category,
          value,
          importance
        });
      }
    } catch (error) {
      console.error("Error saving user preference:", error);
    }
  }
  
  /**
   * Extract and save insights from a conversation
   * @param userId User ID
   * @param conversationId Conversation ID
   */
  async extractInsightsFromConversation(userId: number, conversationId: number): Promise<void> {
    try {
      // First, extract user preferences
      await personalizationManager.extractPreferencesFromConversation(userId, conversationId);
      
      // Then, save a conversation summary
      await this.saveConversationSummary(userId, conversationId);
    } catch (error) {
      console.error("Error extracting insights from conversation:", error);
    }
  }
  
  /**
   * Get memory entries for a conversation
   * @param conversationId Conversation ID
   * @returns Array of memory entries
   */
  async getConversationMemory(conversationId: number): Promise<any[]> {
    try {
      return await storage.getMemoryEntriesByConversationId(conversationId);
    } catch (error) {
      console.error("Error getting conversation memory:", error);
      return [];
    }
  }
  
  /**
   * Get memory entries for a user, grouped by type
   * @param userId User ID
   * @returns Grouped memory entries
   */
  async getUserMemory(userId: number): Promise<{
    preferences: any[],
    insights: any[],
    summaries: any[]
  }> {
    try {
      const allEntries = await storage.getMemoryEntriesByUserId(userId);
      
      return {
        preferences: allEntries.filter(entry => entry.type === 'preference'),
        insights: allEntries.filter(entry => entry.type === 'insight'),
        summaries: allEntries.filter(entry => entry.type === 'summary')
      };
    } catch (error) {
      console.error("Error getting user memory:", error);
      return {
        preferences: [],
        insights: [],
        summaries: []
      };
    }
  }
  
  /**
   * Forget (delete) a specific memory entry
   * @param memoryId Memory entry ID
   * @returns Success status
   */
  async forgetMemory(memoryId: number): Promise<boolean> {
    try {
      return await storage.deleteMemoryEntry(memoryId);
    } catch (error) {
      console.error("Error forgetting memory:", error);
      return false;
    }
  }
  
  /**
   * Generate context for a conversation
   * @param userId User ID
   * @param conversationId Conversation ID
   * @returns Context string for LLM prompt
   */
  async generateContext(userId: number, conversationId: number): Promise<string | null> {
    try {
      return await personalizationManager.generatePersonalizedContext(userId, conversationId);
    } catch (error) {
      console.error("Error generating context:", error);
      return null;
    }
  }
}

// Export singleton instance
export const conversationMemory = new ConversationMemory();