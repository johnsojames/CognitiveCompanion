import { ModelProvider } from "@shared/schema";
import { ClaudeProvider } from "./providers/claude";
import { GPTProvider } from "./providers/gpt";
import { DeepSeekProvider } from "./providers/deepseek";

// Interface for LLM providers
export interface LLMProvider {
  generateResponse(
    userQuery: string, 
    conversationContext: string, 
    documentContexts?: string[]
  ): Promise<string>;
  getModelName(): string;
}

// LLM Factory class for creating appropriate LLM provider instances
export class LLMFactory {
  // Cache providers to avoid creating new instances for the same model
  private providers: Map<string, LLMProvider> = new Map();
  
  // Get an LLM provider based on provider name and model
  getLLMProvider(provider: ModelProvider, model: string): LLMProvider {
    const key = `${provider}:${model}`;
    
    // Return cached provider if exists
    if (this.providers.has(key)) {
      return this.providers.get(key)!;
    }
    
    // Create a new provider
    let llmProvider: LLMProvider;
    
    switch (provider) {
      case "claude":
        llmProvider = new ClaudeProvider(model);
        break;
      case "gpt":
        llmProvider = new GPTProvider(model);
        break;
      case "deepseek":
        llmProvider = new DeepSeekProvider(model);
        break;
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
    
    // Cache the provider
    this.providers.set(key, llmProvider);
    
    return llmProvider;
  }
  
  // Get available models for a provider
  getAvailableModels(provider: ModelProvider): string[] {
    switch (provider) {
      case "claude":
        return [
          "claude-3-7-sonnet-20250219",
          "claude-3-opus-20240229",
          "claude-3-sonnet-20240229",
          "claude-3-haiku-20240307"
        ];
      case "gpt":
        return [
          "gpt-4o",
          "gpt-4-turbo",
          "gpt-3.5-turbo"
        ];
      case "deepseek":
        return [
          "deepseek-coder",
          "deepseek-chat"
        ];
      default:
        return [];
    }
  }
}
