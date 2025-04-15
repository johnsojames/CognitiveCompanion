import fs from 'fs';
import path from 'path';
import { LLMFactory } from '../llm/factory';
import { storage } from '../../storage';
import OpenAI from 'openai';

/**
 * Manages fine-tuning operations for AI models
 */
class FineTuningManager {
  private llmFactory: LLMFactory | null = null;
  private openai: OpenAI | null = null;
  private finetuningScheduleInterval: NodeJS.Timeout | null = null;
  
  /**
   * Set the LLM factory for fine-tuning operations
   * @param llmFactory LLM factory
   */
  setLLMFactory(llmFactory: LLMFactory): void {
    this.llmFactory = llmFactory;
    
    // Initialize OpenAI client if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }
  
  /**
   * Schedule regular fine-tuning jobs
   * @param intervalDays Number of days between fine-tuning jobs
   */
  scheduleRegularFineTuning(intervalDays: number = 30): void {
    // Clear any existing interval
    if (this.finetuningScheduleInterval) {
      clearInterval(this.finetuningScheduleInterval);
    }
    
    // For development/prototype, we'll just log that we would schedule this
    // rather than actually scheduling it to avoid excessive spam
    console.log(`[SETUP] Would schedule fine-tuning every ${intervalDays} days in production`);
    
    // In a production environment, we would use this code:
    /*
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
    
    this.finetuningScheduleInterval = setInterval(async () => {
      try {
        console.log("Running scheduled fine-tuning job");
        // Get all users
        // This is a simplified approach - in a real system, you'd prioritize active users
        const users = await this.getActiveUsers();
        
        for (const user of users) {
          try {
            // Prepare training data
            const trainingFilePath = await this.prepareTrainingData(user.id);
            
            // Start fine-tuning job
            if (trainingFilePath) {
              const jobId = await this.startOpenAIFineTuning(trainingFilePath);
              console.log(`Started fine-tuning job ${jobId} for user ${user.id}`);
            }
          } catch (error) {
            console.error(`Error fine-tuning for user ${user.id}:`, error);
          }
        }
      } catch (error) {
        console.error("Error in scheduled fine-tuning:", error);
      }
    }, intervalMs);
    */
  }
  
  /**
   * Get list of active users for fine-tuning
   */
  private async getActiveUsers(): Promise<{id: number, username: string}[]> {
    try {
      // This is a stub - in a real system, you'd get users who:
      // 1. Have enough conversation history
      // 2. Have been active recently
      // 3. Have opted in to fine-tuning
      
      // For now, just return all users
      const users = []; // await storage.getAllUsers(); (would implement this in real system)
      return users;
    } catch (error) {
      console.error("Error getting active users:", error);
      return [];
    }
  }
  
  /**
   * Prepare training data for fine-tuning from user's conversations
   * @param userId User ID
   * @returns Path to training file
   */
  async prepareTrainingData(userId: number): Promise<string | null> {
    try {
      // Get user's conversations
      const conversations = await storage.getConversationsByUserId(userId);
      
      if (conversations.length < 3) {
        console.log(`Not enough conversations for user ${userId}`);
        return null;
      }
      
      const trainingExamples = [];
      
      // Process each conversation
      for (const conversation of conversations) {
        // Get messages
        const messages = await storage.getMessagesByConversationId(conversation.id);
        
        if (messages.length < 4) continue; // Skip too short conversations
        
        // Group messages into examples
        for (let i = 0; i < messages.length - 1; i++) {
          if (messages[i].role === 'user' && messages[i+1].role === 'assistant') {
            trainingExamples.push({
              messages: [
                { role: 'system', content: 'You are a helpful AI assistant.' },
                { role: 'user', content: messages[i].content },
                { role: 'assistant', content: messages[i+1].content }
              ]
            });
          }
        }
      }
      
      if (trainingExamples.length < 10) {
        console.log(`Not enough training examples for user ${userId}`);
        return null;
      }
      
      // Ensure data directory exists
      const dataDir = path.join(process.cwd(), 'data', 'fine-tuning');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Write training data to file
      const filePath = path.join(dataDir, `user_${userId}_training.jsonl`);
      
      const fileStream = fs.createWriteStream(filePath);
      for (const example of trainingExamples) {
        fileStream.write(JSON.stringify(example) + '\n');
      }
      fileStream.end();
      
      console.log(`Created training file with ${trainingExamples.length} examples for user ${userId}`);
      return filePath;
    } catch (error) {
      console.error("Error preparing training data:", error);
      return null;
    }
  }
  
  /**
   * Start OpenAI fine-tuning job
   * @param trainingFilePath Path to training file
   * @param baseModel Base model to fine-tune
   * @returns Job ID
   */
  async startOpenAIFineTuning(trainingFilePath: string, baseModel: string = 'gpt-4o'): Promise<string> {
    if (!this.openai) {
      throw new Error("OpenAI client not initialized");
    }
    
    try {
      // Upload training file
      const file = await this.openai.files.create({
        file: fs.createReadStream(trainingFilePath),
        purpose: 'fine-tune',
      });
      
      // Start fine-tuning job
      const fineTuningJob = await this.openai.fineTuning.jobs.create({
        training_file: file.id,
        model: baseModel,
        suffix: 'personalized',
      });
      
      console.log(`Started fine-tuning job: ${fineTuningJob.id}`);
      return fineTuningJob.id;
    } catch (error) {
      console.error("Error starting OpenAI fine-tuning:", error);
      throw error;
    }
  }
  
  /**
   * Check fine-tuning job status
   * @param jobId Job ID
   * @returns Job status
   */
  async checkFineTuningStatus(jobId: string): Promise<any> {
    if (!this.openai) {
      throw new Error("OpenAI client not initialized");
    }
    
    try {
      const job = await this.openai.fineTuning.jobs.retrieve(jobId);
      return job;
    } catch (error) {
      console.error("Error checking fine-tuning status:", error);
      throw error;
    }
  }
  
  /**
   * List available fine-tuned models
   * @returns List of fine-tuned models
   */
  async listAvailableModels(): Promise<any[]> {
    if (!this.openai) {
      throw new Error("OpenAI client not initialized");
    }
    
    try {
      const models = await this.openai.models.list();
      return models.data.filter(model => model.id.includes('ft-'));
    } catch (error) {
      console.error("Error listing models:", error);
      return [];
    }
  }
}

// Export singleton instance
export const fineTuningManager = new FineTuningManager();