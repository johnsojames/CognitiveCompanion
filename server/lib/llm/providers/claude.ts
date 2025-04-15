import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider } from '../factory';

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025. Do not change this unless explicitly requested by the user.
export class ClaudeProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;
  
  constructor(model: string = 'claude-3-7-sonnet-20250219') {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "dummy-key-for-development",
    });
    this.model = model;
  }
  
  async generateResponse(
    userQuery: string, 
    conversationContext: string, 
    documentContexts: string[] = []
  ): Promise<string> {
    try {
      // Combine document contexts if any
      const documentContext = documentContexts.length > 0 
        ? `\n\nRelevant information from documents:\n${documentContexts.join('\n\n')}`
        : '';
      
      // Prepare the system message with appropriate context
      const systemMessage = `You are ${this.model}, an AI assistant with the following capabilities:
1. Answer questions based on your knowledge
2. Refer to previous conversation context
3. Use relevant information from provided documents when applicable

${conversationContext ? `Conversation history summary:\n${conversationContext}` : ''}
${documentContext}

Respond in a helpful, accurate, and concise manner. If you don't know something, say so rather than making up information. If referring to information from documents, note the source.`;

      // Make the API call to Claude
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemMessage,
        messages: [
          { role: 'user', content: userQuery }
        ],
      });

      return response.content[0].text;
    } catch (error) {
      console.error("Error calling Claude API:", error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }
  
  getModelName(): string {
    return this.model;
  }
}
