import { IStorage } from '../../storage';

export class ConversationMemory {
  private storage: IStorage;
  private maxMessageCount: number = 10; // Maximum number of messages to include in context
  
  constructor(storage: IStorage) {
    this.storage = storage;
  }
  
  // Get conversation context as a string
  async getConversationContext(conversationId: number): Promise<string> {
    try {
      // Get messages for the conversation
      const allMessages = await this.storage.getMessagesByConversationId(conversationId);
      
      // Skip system messages and only take the most recent exchanges
      const userAssistantMessages = allMessages
        .filter(message => message.role === 'user' || message.role === 'assistant')
        .slice(-this.maxMessageCount);
      
      if (userAssistantMessages.length === 0) {
        return '';
      }
      
      // Format messages into a string
      const formattedContext = userAssistantMessages
        .map(message => `${message.role.toUpperCase()}: ${message.content}`)
        .join('\n\n');
      
      return formattedContext;
    } catch (error) {
      console.error(`Error getting conversation context for ${conversationId}:`, error);
      return '';
    }
  }
  
  // Summarize a conversation
  async summarizeConversation(conversationId: number): Promise<string> {
    // In a real implementation, this would use an LLM to generate a summary
    // For now, we just return a simple message count
    try {
      const messages = await this.storage.getMessagesByConversationId(conversationId);
      return `This conversation contains ${messages.length} messages.`;
    } catch (error) {
      console.error(`Error summarizing conversation ${conversationId}:`, error);
      return '';
    }
  }
  
  // Set the maximum number of messages to include in context
  setMaxMessageCount(count: number): void {
    this.maxMessageCount = count;
  }
}
