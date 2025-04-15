import { LLMFactory, LLMProvider } from '../llm/factory';
import { storage } from '../../storage';

/**
 * Manages personalization and learning from user interactions
 */
class PersonalizationManager {
  private llmFactory: LLMFactory | null = null;
  private llmProvider: LLMProvider | null = null;
  
  /**
   * Set the LLM factory for personalization operations
   * @param llmFactory LLM factory
   */
  setLLMFactory(llmFactory: LLMFactory): void {
    this.llmFactory = llmFactory;
    this.llmProvider = llmFactory.getLLMProvider('gpt', 'gpt-4o');
  }
  
  /**
   * Generate a personalized context based on user history and preferences
   * @param userId User ID
   * @param conversationId Current conversation ID
   * @returns Personalized context for prompts
   */
  async generatePersonalizedContext(userId: number, conversationId: number): Promise<string | null> {
    try {
      // Get user memory entries
      const preferences = await storage.getMemoryEntriesByUserId(userId, 'preference');
      const insights = await storage.getMemoryEntriesByUserId(userId, 'insight');
      
      // Get conversation-specific memory entries
      const conversationEntries = await storage.getMemoryEntriesByConversationId(conversationId);
      
      // If no personalization data available, return null
      if (preferences.length === 0 && insights.length === 0 && conversationEntries.length === 0) {
        return null;
      }
      
      // Build context sections
      const sections = [];
      
      if (preferences.length > 0) {
        const preferencesText = preferences
          .sort((a, b) => (b.importance || 0) - (a.importance || 0))
          .slice(0, 5) // Limit to top 5 preferences
          .map(pref => `- ${pref.key}: ${pref.value}`)
          .join('\n');
        
        sections.push(`USER PREFERENCES:\n${preferencesText}`);
      }
      
      if (insights.length > 0) {
        const insightsText = insights
          .sort((a, b) => (b.importance || 0) - (a.importance || 0))
          .slice(0, 5) // Limit to top 5 insights
          .map(insight => `- ${insight.value}`)
          .join('\n');
        
        sections.push(`INSIGHTS ABOUT USER:\n${insightsText}`);
      }
      
      if (conversationEntries.length > 0) {
        const summaries = conversationEntries
          .filter(entry => entry.type === 'summary')
          .slice(0, 3); // Limit to most recent 3 summaries
        
        if (summaries.length > 0) {
          const summariesText = summaries
            .map(summary => `- ${summary.value}`)
            .join('\n');
          
          sections.push(`CONVERSATION CONTEXT:\n${summariesText}`);
        }
      }
      
      // Return full context
      return sections.join('\n\n');
    } catch (error) {
      console.error("Error generating personalized context:", error);
      return null;
    }
  }
  
  /**
   * Get vocabulary context based on user's patterns
   * @param userId User ID
   * @returns Vocabulary context for prompts
   */
  async getVocabularyContext(userId: number): Promise<string | null> {
    try {
      const vocabEntries = await storage.getMemoryEntriesByUserId(userId, 'vocabulary');
      
      if (vocabEntries.length === 0) {
        return null;
      }
      
      // Get top vocabulary entries by importance
      const topVocab = vocabEntries
        .sort((a, b) => (b.importance || 0) - (a.importance || 0))
        .slice(0, 10); // Limit to top 10 vocabulary patterns
      
      const vocabText = topVocab
        .map(v => `- ${v.key}: ${v.value}`)
        .join('\n');
      
      return `USER VOCABULARY PATTERNS:\n${vocabText}\n\nPlease adapt your language to match these vocabulary preferences.`;
    } catch (error) {
      console.error("Error getting vocabulary context:", error);
      return null;
    }
  }
  
  /**
   * Learn vocabulary patterns from user text
   * @param userId User ID
   * @param text User input text
   */
  async learnVocabularyPatterns(userId: number, text: string): Promise<void> {
    if (!text || text.length < 20) return; // Skip short texts
    
    try {
      if (!this.llmProvider) {
        if (!this.llmFactory) {
          console.error("LLM factory not set in personalization manager");
          return;
        }
        this.llmProvider = this.llmFactory.getLLMProvider('gpt', 'gpt-4o');
      }
      
      const prompt = `
Analyze the following user text and identify vocabulary patterns, frequently used terms, 
and writing style characteristics. Look for:

1. Specialized terminology
2. Writing formality level
3. Preferred phrase constructions
4. Common expressions
5. Technical vs. non-technical language

User text: "${text}"

Return a JSON array with up to 3 vocabulary insights, each with a "key" (pattern name) and "value" (description).
Example:
[
  {"key": "Technical jargon", "value": "Uses machine learning terminology like 'vector embeddings' and 'transformer models'"},
  {"key": "Formal style", "value": "Prefers formal language with complex sentence structures"}
]
`;
      
      const response = await this.llmProvider.generateResponse(prompt, "", []);
      
      try {
        // Extract JSON array from response
        const jsonMatch = response.match(/\[\s*\{.*\}\s*\]/s);
        if (jsonMatch) {
          const patterns = JSON.parse(jsonMatch[0]);
          
          if (Array.isArray(patterns)) {
            // Store each vocabulary pattern
            for (const pattern of patterns) {
              if (pattern.key && pattern.value) {
                // Check if pattern already exists
                const existingEntry = await storage.getMemoryEntryByKey(
                  userId, 
                  pattern.key,
                  'vocabulary'
                );
                
                if (existingEntry) {
                  // Update existing entry
                  await storage.updateMemoryEntry(
                    existingEntry.id,
                    pattern.value,
                    (existingEntry.importance || 1) + 1 // Increase importance
                  );
                } else {
                  // Create new entry
                  await storage.createMemoryEntry({
                    userId,
                    type: 'vocabulary',
                    key: pattern.key,
                    value: pattern.value,
                    importance: 1
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error parsing vocabulary patterns:", error);
      }
    } catch (error) {
      console.error("Error learning vocabulary patterns:", error);
    }
  }
  
  /**
   * Extract user preferences from conversation history
   * @param userId User ID
   * @param conversationId Conversation ID
   */
  async extractPreferencesFromConversation(userId: number, conversationId: number): Promise<void> {
    try {
      if (!this.llmProvider) {
        if (!this.llmFactory) {
          console.error("LLM factory not set in personalization manager");
          return;
        }
        this.llmProvider = this.llmFactory.getLLMProvider('gpt', 'gpt-4o');
      }
      
      // Get messages from conversation
      const messages = await storage.getMessagesByConversationId(conversationId);
      
      // Only analyze conversations with at least 3 user messages
      const userMessages = messages.filter(msg => msg.role === 'user');
      if (userMessages.length < 3) return;
      
      // Extract user message content
      const userContent = userMessages.map(msg => msg.content).join('\n\n');
      
      const prompt = `
Based on the following user messages, identify preferences, interests, and recurring topics.
Look for explicit preferences as well as implied preferences.

User messages:
${userContent}

Return a JSON array with up to 3 preference insights, each with a "key" (preference category) and "value" (specific preference).
Example:
[
  {"key": "Programming language", "value": "Prefers Python over JavaScript"},
  {"key": "Communication style", "value": "Likes detailed explanations with examples"}
]
`;
      
      const response = await this.llmProvider.generateResponse(prompt, "", []);
      
      try {
        // Extract JSON array from response
        const jsonMatch = response.match(/\[\s*\{.*\}\s*\]/s);
        if (jsonMatch) {
          const preferences = JSON.parse(jsonMatch[0]);
          
          if (Array.isArray(preferences)) {
            // Store each preference
            for (const pref of preferences) {
              if (pref.key && pref.value) {
                // Check if preference already exists
                const existingEntry = await storage.getMemoryEntryByKey(
                  userId, 
                  pref.key,
                  'preference'
                );
                
                if (existingEntry) {
                  // Update existing entry
                  await storage.updateMemoryEntry(
                    existingEntry.id,
                    pref.value,
                    (existingEntry.importance || 1) + 1 // Increase importance
                  );
                } else {
                  // Create new entry
                  await storage.createMemoryEntry({
                    userId,
                    type: 'preference',
                    key: pref.key,
                    value: pref.value,
                    importance: 1
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error parsing user preferences:", error);
      }
    } catch (error) {
      console.error("Error extracting preferences:", error);
    }
  }
  
  /**
   * Generate a summary of a conversation
   * @param conversationId Conversation ID
   * @returns Conversation summary
   */
  async generateConversationSummary(conversationId: number): Promise<string | null> {
    try {
      if (!this.llmProvider) {
        if (!this.llmFactory) {
          console.error("LLM factory not set in personalization manager");
          return null;
        }
        this.llmProvider = this.llmFactory.getLLMProvider('gpt', 'gpt-4o');
      }
      
      // Get conversation
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) return null;
      
      // Get messages
      const messages = await storage.getMessagesByConversationId(conversationId);
      if (messages.length < 3) return null; // Need at least a few messages
      
      // Format messages for summarization
      const formattedMessages = messages.map(msg => {
        return `${msg.role.toUpperCase()}: ${msg.content}`;
      }).join('\n\n');
      
      const prompt = `
Summarize the following conversation in 1-2 concise sentences.
Focus on the main topics discussed and any conclusions reached.

CONVERSATION:
${formattedMessages}

SUMMARY:
`;
      
      return await this.llmProvider.generateResponse(prompt, "", []);
    } catch (error) {
      console.error("Error generating conversation summary:", error);
      return null;
    }
  }
}

// Export singleton instance
export const personalizationManager = new PersonalizationManager();