import OpenAI from "openai";
import { LLMProvider } from '../factory';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
export class GPTProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;
  
  constructor(model: string = 'gpt-4o') {
    this.client = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY || "dummy-key-for-development",
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

      // Make the API call to GPT
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userQuery }
        ],
        max_tokens: 1000,
      });

      return completion.choices[0].message.content || "No response generated";
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }
  
  getModelName(): string {
    return this.model;
  }
}
