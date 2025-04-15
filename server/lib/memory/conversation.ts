import { IStorage } from '../../storage';
import { LLMFactory } from '../llm/factory';
import { ModelProvider } from '@shared/schema';

export class ConversationMemory {
  private storage: IStorage;
  private llmFactory: LLMFactory;
  private maxMessageCount: number = 10; // Maximum number of messages to include in context
  private summarizationThreshold: number = 15; // Number of messages that trigger summarization
  private preferredProvider: ModelProvider = 'gpt'; // Default provider for summaries
  private preferredModel: string = 'gpt-4o'; // Default model for summaries
  
  constructor(storage: IStorage) {
    this.storage = storage;
    this.llmFactory = new LLMFactory();
  }
  
  /**
   * Set the preferred LLM provider and model for summarization
   */
  setPreferredModel(provider: ModelProvider, model: string): void {
    this.preferredProvider = provider;
    this.preferredModel = model;
  }
  
  /**
   * Get conversation context as a string
   * This may include either the full recent message history or a summary plus recent messages
   */
  async getConversationContext(conversationId: number): Promise<string> {
    try {
      // First check if we have a stored summary for this conversation
      const storedSummary = await this.getStoredSummary(conversationId);
      
      // Get messages for the conversation
      const allMessages = await this.storage.getMessagesByConversationId(conversationId);
      
      // Skip system messages and only take the most recent exchanges
      const userAssistantMessages = allMessages
        .filter(message => message.role === 'user' || message.role === 'assistant');
      
      if (userAssistantMessages.length === 0) {
        return '';
      }
      
      // If we have too many messages and no summary yet, create one
      if (userAssistantMessages.length > this.summarizationThreshold && !storedSummary) {
        // Get all but the most recent messages to summarize
        const messagesToSummarize = userAssistantMessages.slice(0, -this.maxMessageCount);
        
        // Generate and store the summary asynchronously (don't await)
        this.generateAndStoreSummary(conversationId, messagesToSummarize);
      }
      
      // Determine whether to use the summary + recent messages or just recent messages
      let formattedContext = '';
      
      if (storedSummary && userAssistantMessages.length > this.maxMessageCount) {
        // Use the summary plus the most recent messages
        const recentMessages = userAssistantMessages.slice(-this.maxMessageCount);
        const recentMessagesText = recentMessages
          .map(message => `${message.role.toUpperCase()}: ${message.content}`)
          .join('\n\n');
        
        formattedContext = `CONVERSATION SUMMARY: ${storedSummary}\n\nMOST RECENT MESSAGES:\n\n${recentMessagesText}`;
      } else {
        // Just use the most recent messages (up to maxMessageCount)
        const messagesToInclude = userAssistantMessages.slice(-this.maxMessageCount);
        formattedContext = messagesToInclude
          .map(message => `${message.role.toUpperCase()}: ${message.content}`)
          .join('\n\n');
      }
      
      return formattedContext;
    } catch (error) {
      console.error(`Error getting conversation context for ${conversationId}:`, error);
      return '';
    }
  }
  
  /**
   * Retrieve a stored summary for a conversation if it exists
   */
  private async getStoredSummary(conversationId: number): Promise<string | null> {
    try {
      const summaryEntry = await this.storage.getMemoryEntriesByConversationId(conversationId, 'summary');
      
      if (summaryEntry.length === 0) {
        return null;
      }
      
      // Get the most recent summary (by lastUpdated)
      const latestSummary = summaryEntry.sort((a, b) => 
        b.lastUpdated.getTime() - a.lastUpdated.getTime()
      )[0];
      
      return latestSummary.value;
    } catch (error) {
      console.error(`Error retrieving stored summary for conversation ${conversationId}:`, error);
      return null;
    }
  }
  
  /**
   * Generate and store a summary of messages
   */
  private async generateAndStoreSummary(conversationId: number, messages: any[]): Promise<void> {
    try {
      const conversation = await this.storage.getConversation(conversationId);
      if (!conversation) {
        console.error(`Conversation ${conversationId} not found for summarization`);
        return;
      }
      
      // Format messages for the summarization prompt
      const formattedMessages = messages
        .map(message => `${message.role.toUpperCase()}: ${message.content}`)
        .join('\n\n');
      
      // Get the LLM provider for summarization
      const llmProvider = this.llmFactory.getLLMProvider(this.preferredProvider, this.preferredModel);
      
      // Create the summarization prompt
      const summarizationPrompt = `Below is a conversation between a user and an AI assistant. 
Please create a concise summary (no more than 150 words) that captures:
1. The main topics discussed
2. Any key information shared by the user
3. Any decisions or conclusions reached
4. Any pending questions or unresolved issues

CONVERSATION:
${formattedMessages}

SUMMARY:`;

      // Generate the summary
      const summary = await llmProvider.generateResponse(summarizationPrompt, '', []);
      
      // Store the summary in memory storage
      const existingSummaries = await this.storage.getMemoryEntriesByConversationId(conversationId, 'summary');
      
      if (existingSummaries.length > 0) {
        // Update the existing summary
        await this.storage.updateMemoryEntry(existingSummaries[0].id, summary, 8);
      } else {
        // Create a new summary entry
        await this.storage.createMemoryEntry({
          userId: conversation.userId,
          conversationId,
          type: 'summary',
          key: 'conversation_summary',
          value: summary,
          importance: 8
        });
      }
      
      console.log(`Generated and stored summary for conversation ${conversationId}`);
    } catch (error) {
      console.error(`Error generating summary for conversation ${conversationId}:`, error);
    }
  }
  
  /**
   * Force summarize a conversation (useful for when a conversation ends)
   */
  async summarizeConversation(conversationId: number): Promise<string> {
    try {
      const conversation = await this.storage.getConversation(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      const messages = await this.storage.getMessagesByConversationId(conversationId);
      
      // Only summarize if there are enough messages
      if (messages.length < 3) {
        return 'Not enough messages to summarize';
      }
      
      // Format the messages for the LLM
      const userAssistantMessages = messages
        .filter(message => message.role === 'user' || message.role === 'assistant');
      
      // Format messages for the summarization prompt
      const formattedMessages = userAssistantMessages
        .map(message => `${message.role.toUpperCase()}: ${message.content}`)
        .join('\n\n');
      
      // Get the LLM provider for summarization
      const llmProvider = this.llmFactory.getLLMProvider(this.preferredProvider, this.preferredModel);
      
      // Create the summarization prompt
      const summarizationPrompt = `Below is a conversation between a user and an AI assistant. 
Please create a concise summary (no more than 200 words) that captures:
1. The main topics discussed
2. Any key information shared by the user
3. Any decisions or conclusions reached
4. Any pending questions or unresolved issues

CONVERSATION:
${formattedMessages}

SUMMARY:`;

      // Generate the summary
      const summary = await llmProvider.generateResponse(summarizationPrompt, '', []);
      
      // Store the summary in memory storage
      const existingSummaries = await this.storage.getMemoryEntriesByConversationId(conversationId, 'summary');
      
      if (existingSummaries.length > 0) {
        // Update the existing summary
        await this.storage.updateMemoryEntry(existingSummaries[0].id, summary, 8);
      } else {
        // Create a new summary entry
        await this.storage.createMemoryEntry({
          userId: conversation.userId,
          conversationId,
          type: 'summary',
          key: 'conversation_summary',
          value: summary,
          importance: 8
        });
      }
      
      return summary;
    } catch (error) {
      console.error(`Error summarizing conversation ${conversationId}:`, error);
      return 'Failed to generate summary';
    }
  }
  
  /**
   * Extract and store insights from a conversation
   */
  async extractInsights(conversationId: number): Promise<void> {
    try {
      const conversation = await this.storage.getConversation(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      const messages = await this.storage.getMessagesByConversationId(conversationId);
      
      // Only extract insights if there are enough messages
      if (messages.length < 5) {
        return;
      }
      
      // Format the messages for the LLM
      const userAssistantMessages = messages
        .filter(message => message.role === 'user' || message.role === 'assistant');
      
      const formattedMessages = userAssistantMessages
        .map(message => `${message.role.toUpperCase()}: ${message.content}`)
        .join('\n\n');
      
      // Get the LLM provider for insight extraction
      const llmProvider = this.llmFactory.getLLMProvider(this.preferredProvider, this.preferredModel);
      
      // Create the insight extraction prompt
      const insightPrompt = `Below is a conversation between a user and an AI assistant.
Please analyze the conversation and extract between 1-3 key insights about the user's preferences, interests, or work. Format each insight as a JSON object with "key" and "value" properties.

CONVERSATION:
${formattedMessages}

INSIGHTS (JSON format):
[
  {"key": "user_preference_example", "value": "The user prefers detailed explanations with code examples."},
  {"key": "user_interest_example", "value": "The user is interested in machine learning applications."}
]`;

      // Generate the insights
      const insightsResponse = await llmProvider.generateResponse(insightPrompt, '', []);
      
      // Try to parse the JSON
      try {
        // Extract the JSON portion of the response (the model might add extra text)
        const jsonMatch = insightsResponse.match(/\[[\s\S]*\]/);
        const jsonString = jsonMatch ? jsonMatch[0] : insightsResponse;
        
        const insights = JSON.parse(jsonString);
        
        // Store each insight
        for (const insight of insights) {
          if (insight.key && insight.value) {
            // Check if we already have this insight key
            const existingInsight = await this.storage.getMemoryEntryByKey(
              conversation.userId, 
              insight.key, 
              'insight'
            );
            
            if (existingInsight) {
              // Update the existing insight
              await this.storage.updateMemoryEntry(existingInsight.id, insight.value, 5);
            } else {
              // Create a new insight
              await this.storage.createMemoryEntry({
                userId: conversation.userId,
                conversationId,
                type: 'insight',
                key: insight.key,
                value: insight.value,
                importance: 5
              });
            }
          }
        }
        
        console.log(`Extracted and stored ${insights.length} insights for conversation ${conversationId}`);
      } catch (parseError) {
        console.error('Failed to parse insights JSON:', parseError);
      }
    } catch (error) {
      console.error(`Error extracting insights for conversation ${conversationId}:`, error);
    }
  }
  
  /**
   * Store a user preference explicitly
   */
  async storeUserPreference(userId: number, key: string, value: string, importance: number = 7): Promise<void> {
    try {
      // Check if this preference already exists
      const existingPreference = await this.storage.getMemoryEntryByKey(userId, key, 'preference');
      
      if (existingPreference) {
        // Update the existing preference
        await this.storage.updateMemoryEntry(existingPreference.id, value, importance);
      } else {
        // Create a new preference
        await this.storage.createMemoryEntry({
          userId,
          conversationId: null,
          type: 'preference',
          key,
          value,
          importance
        });
      }
      
      console.log(`Stored user preference: ${key} = ${value} for user ${userId}`);
    } catch (error) {
      console.error(`Error storing user preference for user ${userId}:`, error);
    }
  }
  
  /**
   * Get all memory (summaries, insights, preferences) for a user
   */
  async getUserMemory(userId: number): Promise<any> {
    try {
      const allMemory = await this.storage.getMemoryEntriesByUserId(userId);
      
      // Organize by type
      const summaries = allMemory.filter(m => m.type === 'summary');
      const insights = allMemory.filter(m => m.type === 'insight');
      const preferences = allMemory.filter(m => m.type === 'preference');
      
      return {
        summaries,
        insights,
        preferences
      };
    } catch (error) {
      console.error(`Error retrieving memory for user ${userId}:`, error);
      return {
        summaries: [],
        insights: [],
        preferences: []
      };
    }
  }
  
  /**
   * Set the maximum number of messages to include in context
   */
  setMaxMessageCount(count: number): void {
    this.maxMessageCount = count;
  }
  
  /**
   * Set the threshold for when summarization occurs
   */
  setSummarizationThreshold(count: number): void {
    this.summarizationThreshold = count;
  }
}
