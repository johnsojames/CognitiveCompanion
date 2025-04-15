import { LLMProvider } from '../factory';
import fetch from 'node-fetch';

export class DeepSeekProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private apiUrl: string = 'https://api.deepseek.com/v1/chat/completions';
  
  constructor(model: string = 'deepseek-coder') {
    this.apiKey = process.env.DEEPSEEK_API_KEY || "dummy-key-for-development";
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

      // Make the API call to DeepSeek
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userQuery }
          ],
          max_tokens: 1000,
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
      }
      
      const data = await response.json();
      return data.choices[0].message.content || "No response generated";
    } catch (error) {
      console.error("Error calling DeepSeek API:", error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }
  
  getModelName(): string {
    return this.model;
  }
}
