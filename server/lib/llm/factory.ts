import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { personalizationManager } from '../learning/personalization';
import { fineTuningManager } from '../learning/fine-tuning';
import { LLMProvider } from './provider';

/**
 * Claude (Anthropic) LLM provider
 */
class ClaudeLLM implements LLMProvider {
  private client: Anthropic;
  private model: string;
  
  /**
   * Create a new Claude LLM provider
   * @param model Model name
   */
  constructor(model: string = 'claude-3-7-sonnet-20250219') {
    // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });
    this.model = model;
  }
  
  /**
   * Generate a response using Claude
   * @param prompt User prompt
   * @param systemContext Additional system context
   * @param documentContexts Document contexts
   * @returns Generated response
   */
  async generateResponse(prompt: string, systemContext: string, documentContexts: string[]): Promise<string> {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not set");
    }
    
    let systemPrompt = `You are a helpful AI assistant. You have access to conversation history and relevant documents.`;
    
    if (systemContext) {
      systemPrompt += `\n\n${systemContext}`;
    }
    
    let fullPrompt = prompt;
    
    // Add document contexts if available
    if (documentContexts.length > 0) {
      fullPrompt = `${prompt}\n\nRelevant document context:\n${documentContexts.join('\n\n')}`;
    }
    
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: fullPrompt }
        ]
      });
      
      // Handle response format - check if it's an array or single object
      if (Array.isArray(response.content)) {
        return response.content[0].text;
      } else {
        return response.content.toString();
      }
    } catch (error) {
      console.error("Error generating Claude response:", error);
      throw error;
    }
  }
}

/**
 * OpenAI GPT LLM provider
 */
class OpenAILLM implements LLMProvider {
  private client: OpenAI;
  private model: string;
  
  /**
   * Create a new OpenAI LLM provider
   * @param model Model name
   */
  constructor(model: string = 'gpt-4o') {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    });
    this.model = model;
  }
  
  /**
   * Generate a response using OpenAI
   * @param prompt User prompt
   * @param systemContext Additional system context
   * @param documentContexts Document contexts
   * @returns Generated response
   */
  async generateResponse(prompt: string, systemContext: string, documentContexts: string[]): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not set");
    }
    
    // System message with context
    let systemPrompt = `You are a helpful AI assistant. You have access to conversation history and relevant documents.`;
    
    if (systemContext) {
      systemPrompt += `\n\n${systemContext}`;
    }
    
    const messages: Array<{role: string, content: string}> = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add document contexts if available
    if (documentContexts.length > 0) {
      const documentsContent = `Here are relevant documents for your reference:\n${documentContexts.join('\n\n')}`;
      messages.push({ role: 'user', content: documentsContent });
      messages.push({ role: 'assistant', content: "I've reviewed these documents and will use them to inform my response." });
    }
    
    // Add the user's prompt
    messages.push({ role: 'user', content: prompt });
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: 4000
      });
      
      return response.choices[0].message.content || '';
    } catch (error) {
      console.error("Error generating OpenAI response:", error);
      throw error;
    }
  }
}

/**
 * LLM factory to create LLM providers
 */
export class LLMFactory {
  /**
   * Create an LLM provider
   * @param provider Provider name (claude, gpt)
   * @param model Model name
   * @returns LLM provider
   */
  getLLMProvider(provider: string, model: string): LLMProvider {
    // Don't initialize here - this causes infinite recursion
    // This should be done once at application startup
    
    switch (provider.toLowerCase()) {
      case 'claude':
        return new ClaudeLLM(model);
      case 'gpt':
        // Check if this is a fine-tuned model
        if (model.includes('ft-')) {
          console.log(`Using fine-tuned model: ${model}`);
        }
        return new OpenAILLM(model);
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }
}