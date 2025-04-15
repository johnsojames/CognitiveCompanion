import { storage } from "../../storage";
import { LLMFactory } from "../llm/factory";

/**
 * Manages user personalization through learning and context adaptation
 */
class PersonalizationManager {
  private llmFactory: LLMFactory | null = null;
  
  /**
   * Set the LLM factory for generating insights
   * @param llmFactory The LLM factory instance
   */
  setLLMFactory(llmFactory: LLMFactory): void {
    this.llmFactory = llmFactory;
  }
  
  /**
   * Generate personalized context for a user's conversation
   * @param userId User ID
   * @param conversationId Conversation ID
   * @returns Personalized context as a string
   */
  async generatePersonalizedContext(userId: number, conversationId: number): Promise<string> {
    try {
      // Get recent memory entries for this user (preferences and insights)
      const preferences = await storage.getMemoryEntriesByUserId(userId, 'preference');
      const insights = await storage.getMemoryEntriesByUserId(userId, 'insight');
      
      // Sort by importance (highest first)
      const sortedPreferences = preferences.sort((a, b) => 
        (b.importance ?? 0) - (a.importance ?? 0)
      ).slice(0, 5); // Top 5 preferences
      
      const sortedInsights = insights.sort((a, b) => 
        (b.importance ?? 0) - (a.importance ?? 0)
      ).slice(0, 5); // Top 5 insights
      
      // Build personalized context
      let context = "USER CONTEXT:\n";
      
      if (sortedPreferences.length > 0) {
        context += "User preferences:\n";
        for (const pref of sortedPreferences) {
          context += `- ${pref.key}: ${pref.value}\n`;
        }
        context += "\n";
      }
      
      if (sortedInsights.length > 0) {
        context += "User insights:\n";
        for (const insight of sortedInsights) {
          context += `- ${insight.value}\n`;
        }
        context += "\n";
      }
      
      // If we have no personalized context, return empty string
      if (sortedPreferences.length === 0 && sortedInsights.length === 0) {
        return "";
      }
      
      return context;
    } catch (error) {
      console.error("Error generating personalized context:", error);
      return ""; // Return empty context on error
    }
  }
  
  /**
   * Learn vocabulary and communication patterns from user input
   * @param userId User ID
   * @param text User input text
   */
  async learnVocabularyPatterns(userId: number, text: string): Promise<void> {
    try {
      if (!this.llmFactory) return;
      
      // Use a lightweight model for analysis to save costs
      const llm = this.llmFactory.getLLMProvider('gpt', 'gpt-4o');
      
      // Get previous vocabulary context if exists
      const existingVocab = await storage.getMemoryEntryByKey(userId, 'vocabulary_patterns', 'learning');
      
      // Analyze text for vocabulary patterns
      const prompt = `
You are a vocabulary and communication style analyst. 
Analyze the following text to identify vocabulary patterns, communication style, and language preferences.
Focus on finding distinctive word choices, phrases, formality level, technical terms, or jargon.

User's text: "${text}"

${existingVocab ? 'Previous analysis: ' + existingVocab.value : ''}

Provide a concise summary of 2-3 sentences about the user's vocabulary and communication style.
`;
      
      const analysis = await llm.generateResponse(prompt, "", []);
      
      // Save or update vocabulary context
      if (existingVocab) {
        await storage.updateMemoryEntry(existingVocab.id, analysis);
      } else {
        await storage.createMemoryEntry({
          userId,
          conversationId: null,
          type: 'learning',
          key: 'vocabulary_patterns',
          value: analysis,
          importance: 8 // High importance
        });
      }
    } catch (error) {
      console.error("Error learning vocabulary patterns:", error);
    }
  }
  
  /**
   * Get vocabulary context for a user
   * @param userId User ID
   * @returns Vocabulary context as a string
   */
  async getVocabularyContext(userId: number): Promise<string> {
    try {
      const vocabEntry = await storage.getMemoryEntryByKey(userId, 'vocabulary_patterns', 'learning');
      
      if (vocabEntry) {
        return `COMMUNICATION STYLE CONTEXT:\n${vocabEntry.value}\n\nPlease adapt to this communication style in your responses.\n`;
      }
      
      return ""; // No vocabulary context yet
    } catch (error) {
      console.error("Error getting vocabulary context:", error);
      return ""; // Return empty context on error
    }
  }
  
  /**
   * Update user preferences based on conversation
   * @param userId User ID
   * @param conversationId Conversation ID
   */
  async updatePreferencesFromConversation(userId: number, conversationId: number): Promise<void> {
    try {
      if (!this.llmFactory) return;
      
      // Get messages from this conversation
      const messages = await storage.getMessagesByConversationId(conversationId);
      
      // Need at least a few messages to analyze
      if (messages.length < 3) return;
      
      // Use a model for preference analysis
      const llm = this.llmFactory.getLLMProvider('gpt', 'gpt-4o');
      
      // Format conversation for analysis
      const conversation = messages.map(msg => 
        `${msg.role.toUpperCase()}: ${msg.content}`
      ).join('\n\n');
      
      // Prompt for preference analysis
      const prompt = `
Analyze this conversation to identify user preferences. Look for:
1. Topics they seem interested in
2. Opinions or stances they've expressed
3. Interaction style preferences
4. Any explicit preferences they've mentioned

Conversation:
${conversation}

Format your response as a JSON array with objects containing "key" and "value" fields.
Example: [{"key": "prefers_technical_details", "value": "User seems to prefer detailed technical explanations"}]
Provide at most 3 inferred preferences.
`;
      
      const analysisJson = await llm.generateResponse(prompt, "", []);
      
      // Parse the JSON response
      try {
        const preferences = JSON.parse(analysisJson);
        
        if (Array.isArray(preferences)) {
          // Store each detected preference
          for (const pref of preferences) {
            if (pref.key && pref.value) {
              // Check if this preference already exists
              const existing = await storage.getMemoryEntryByKey(userId, pref.key, 'preference');
              
              if (existing) {
                // Update if significantly different
                if (existing.value !== pref.value) {
                  await storage.updateMemoryEntry(existing.id, pref.value);
                }
              } else {
                // Create new preference
                await storage.createMemoryEntry({
                  userId,
                  conversationId: null, // Preferences are global
                  type: 'preference',
                  key: pref.key,
                  value: pref.value,
                  importance: 6 // Medium importance for inferred preferences
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("Error parsing preference analysis:", error);
      }
    } catch (error) {
      console.error("Error updating preferences from conversation:", error);
    }
  }
}

// Create a singleton instance
export const personalizationManager = new PersonalizationManager();