import { LLMFactory } from '../llm/factory';
import { personalizationManager } from './personalization';
import { fineTuningManager } from './fine-tuning';
import { HybridSearch } from '../rag/hybrid-search';
import { MultiStepRetrieval } from '../rag/multi-step-retrieval';
import { QueryReformulation } from '../rag/query-reformulation';
import { createVectorStore } from '../vectorstore';

/**
 * Integrates all learning capabilities into one central module
 */
class LearningIntegration {
  initialized: boolean = false;
  private llmFactory: LLMFactory | null = null;
  private hybridSearch: HybridSearch | null = null;
  private multiStepRetrieval: MultiStepRetrieval | null = null;
  private queryReformulation: QueryReformulation | null = null;
  
  /**
   * Initialize all learning components
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      console.log("Initializing learning integration...");
      
      // Create LLM factory
      this.llmFactory = new LLMFactory();
      
      // Explicitly set up managers first to avoid circular initialization
      personalizationManager.setLLMFactory(this.llmFactory);
      fineTuningManager.setLLMFactory(this.llmFactory);
      
      // Only after initialization, schedule any tasks
      fineTuningManager.scheduleRegularFineTuning(30); // Every 30 days
      
      // Initialize RAG components
      const vectorStore = createVectorStore();
      this.hybridSearch = new HybridSearch(vectorStore);
      this.multiStepRetrieval = new MultiStepRetrieval(this.llmFactory, vectorStore);
      this.queryReformulation = new QueryReformulation(this.llmFactory);
      
      this.initialized = true;
      console.log("Learning integration initialized successfully");
    } catch (error) {
      console.error("Error initializing learning integration:", error);
      throw error;
    }
  }
  
  /**
   * Learn from user's input text
   * @param userId User ID
   * @param text Input text
   */
  async learnFromUserInput(userId: number, text: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Learn vocabulary patterns
      await personalizationManager.learnVocabularyPatterns(userId, text);
    } catch (error) {
      console.error("Error learning from user input:", error);
    }
  }
  
  /**
   * Enhance a prompt with personalized context
   * @param userId User ID
   * @param conversationId Conversation ID
   * @param userMessage Original user message
   * @returns Enhanced prompt
   */
  async enhancePrompt(userId: number, conversationId: number, userMessage: string): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // First, try to reformulate the query for better retrieval
      let enhancedQuery = userMessage;
      
      if (this.queryReformulation) {
        try {
          const reformulated = await this.queryReformulation.reformulateQuery(userMessage);
          if (reformulated) {
            enhancedQuery = reformulated;
            console.log("Query reformulated:", reformulated);
          }
        } catch (error) {
          console.error("Error reformulating query:", error);
        }
      }
      
      return enhancedQuery;
    } catch (error) {
      console.error("Error enhancing prompt:", error);
      return userMessage; // Fall back to original message
    }
  }
  
  /**
   * Perform advanced search using multiple techniques
   * @param query Search query
   * @param limit Maximum number of results
   * @returns Search results
   */
  async advancedSearch(query: string, limit: number = 5): Promise<Array<{id: number, score: number, content: string}>> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      if (this.multiStepRetrieval) {
        // Try multi-step retrieval first
        try {
          const multiStepResults = await this.multiStepRetrieval.retrieveDocuments(query, limit);
          if (multiStepResults.length > 0) {
            return multiStepResults;
          }
        } catch (error) {
          console.error("Error in multi-step retrieval:", error);
        }
      }
      
      if (this.hybridSearch) {
        // Fall back to hybrid search
        try {
          return await this.hybridSearch.search(query, limit);
        } catch (error) {
          console.error("Error in hybrid search:", error);
        }
      }
      
      // Return empty array if all methods fail
      return [];
    } catch (error) {
      console.error("Error in advanced search:", error);
      return [];
    }
  }
}

// Export singleton instance
export const learningIntegration = new LearningIntegration();