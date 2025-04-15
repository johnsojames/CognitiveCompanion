import { LLMFactory } from '../llm/factory';
import { createVectorStore } from '../vectorstore';
import { MultiStepRetrieval } from '../rag/multi-step-retrieval';
import { personalizationManager } from './personalization';
import { fineTuningManager } from './fine-tuning';
import { ModelProvider } from '../../shared/schema';

/**
 * Integrates learning capabilities into the main system
 */
export class LearningIntegration {
  private llmFactory: LLMFactory;
  private multiStepRetrieval: MultiStepRetrieval;
  initialized: boolean = false;
  
  constructor(llmFactory: LLMFactory) {
    this.llmFactory = llmFactory;
    const vectorStore = createVectorStore();
    this.multiStepRetrieval = new MultiStepRetrieval(vectorStore, llmFactory);
  }
  
  /**
   * Initialize the integration services
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      console.log("Initializing LearningIntegration services...");
      
      // Initialize multi-step retrieval
      await this.multiStepRetrieval.initialize();
      
      // Schedule regular fine-tuning
      // Only in production to avoid unnecessary API calls during development
      if (process.env.NODE_ENV === 'production') {
        fineTuningManager.scheduleRegularFineTuning(30); // Once every 30 days
      }
      
      this.initialized = true;
      console.log("LearningIntegration services initialized successfully");
    } catch (error) {
      console.error("Error initializing LearningIntegration:", error);
      // Don't throw, allow the application to continue
    }
  }
  
  /**
   * Enhance a prompt with personalization and context
   * @param userId User ID
   * @param conversationId Conversation ID
   * @param prompt Original prompt
   * @returns Enhanced prompt
   */
  async enhancePrompt(userId: number, conversationId: number, prompt: string): Promise<string> {
    try {
      // Get personalized context based on user history
      const personalContext = await personalizationManager.generatePersonalizedContext(
        userId, 
        conversationId
      );
      
      // Get vocabulary context
      const vocabularyContext = await personalizationManager.getVocabularyContext(userId);
      
      // Combine contexts with the original prompt
      let enhancedPrompt = prompt;
      
      if (personalContext) {
        enhancedPrompt = `${personalContext}\n\n${enhancedPrompt}`;
      }
      
      if (vocabularyContext) {
        enhancedPrompt = `${vocabularyContext}\n\n${enhancedPrompt}`;
      }
      
      return enhancedPrompt;
    } catch (error) {
      console.error("Error enhancing prompt:", error);
      return prompt; // Return original prompt if enhancement fails
    }
  }
  
  /**
   * Learn from user input - extract vocabulary patterns and store them
   * @param userId User ID
   * @param text User input text
   */
  async learnFromUserInput(userId: number, text: string): Promise<void> {
    try {
      // Learn vocabulary patterns
      await personalizationManager.learnVocabularyPatterns(userId, text);
    } catch (error) {
      console.error("Error learning from user input:", error);
    }
  }
  
  /**
   * Execute an advanced RAG search using multiple techniques
   * @param query User query
   * @param limit Maximum number of results
   * @returns Search results
   */
  async advancedSearch(query: string, limit: number = 5): Promise<any[]> {
    try {
      return await this.multiStepRetrieval.retrieveForComplexQuery(query, limit);
    } catch (error) {
      console.error("Error in advanced search:", error);
      return []; // Return empty results on error
    }
  }
  
  /**
   * Check if we have fine-tuned models available
   * @param provider Model provider
   * @returns Available fine-tuned models
   */
  async getAvailableFineTunedModels(provider: ModelProvider = 'gpt'): Promise<string[]> {
    try {
      if (provider !== 'gpt') {
        return []; // Currently only OpenAI models support fine-tuning in our system
      }
      
      const models = await fineTuningManager.listAvailableModels();
      return models.map(model => model.id);
    } catch (error) {
      console.error("Error getting fine-tuned models:", error);
      return [];
    }
  }
  
  /**
   * Start a new fine-tuning job for a specific user
   * @param userId User ID to fine-tune for
   * @param baseModel Base model to fine-tune
   * @returns Job ID of the fine-tuning job
   */
  async startFineTuningForUser(userId: number, baseModel: string = 'gpt-4o'): Promise<string> {
    try {
      // Prepare training data for this user
      const trainingFilePath = await fineTuningManager.prepareTrainingData(userId);
      
      // Start fine-tuning job
      return await fineTuningManager.startOpenAIFineTuning(trainingFilePath, baseModel);
    } catch (error) {
      console.error("Error starting fine-tuning for user:", error);
      throw error;
    }
  }
}

// Create a singleton instance
export const learningIntegration = new LearningIntegration(new LLMFactory());