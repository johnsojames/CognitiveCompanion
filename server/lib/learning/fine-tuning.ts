import fs from 'fs';
import path from 'path';
import { storage } from '../../storage';
import OpenAI from 'openai';
import { LLMFactory } from '../llm/factory';

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Type definitions
interface FineTuningJob {
  id: string;
  model: string;
  status: string;
  created_at: number;
}

interface FineTunedModel {
  id: string;
  created_at: number;
  fine_tuned_model: string;
}

/**
 * Manages fine-tuning of LLM models
 */
class FineTuningManager {
  private llmFactory: LLMFactory | null = null;
  private jobs: Record<string, FineTuningJob> = {};
  private models: FineTunedModel[] = [];
  private isCheckingJobs: boolean = false;
  private scheduledJobCheck: NodeJS.Timeout | null = null;
  
  /**
   * Set the LLM factory for generating training data
   * @param llmFactory The LLM factory to use
   */
  setLLMFactory(llmFactory: LLMFactory): void {
    this.llmFactory = llmFactory;
  }
  
  /**
   * Schedule regular fine-tuning checks and updates
   * @param intervalDays Number of days between fine-tuning
   */
  scheduleRegularFineTuning(intervalDays: number = 30): void {
    // Check for completed jobs every hour
    this.scheduledJobCheck = setInterval(() => {
      this.checkFineTuningJobs().catch(err => {
        console.error("Error checking fine-tuning jobs:", err);
      });
    }, 60 * 60 * 1000); // Every hour
    
    // Schedule refreshing models list daily
    setInterval(() => {
      this.refreshAvailableModels().catch(err => {
        console.error("Error refreshing models list:", err);
      });
    }, 24 * 60 * 60 * 1000); // Daily
    
    console.log(`Scheduled regular fine-tuning checks with interval of ${intervalDays} days`);
  }
  
  /**
   * Prepare training data from a user's conversations
   * @param userId User ID to prepare training data for
   * @returns Path to the training file
   */
  async prepareTrainingData(userId: number): Promise<string> {
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data', { recursive: true });
    }
    
    const filePath = path.join('./data', `training_${userId}_${Date.now()}.jsonl`);
    
    try {
      // Get all conversations for this user
      const conversations = await storage.getConversationsByUserId(userId);
      
      // Filter to conversations with at least 10 messages
      const validConversations = await Promise.all(
        conversations.map(async (conv) => {
          const messages = await storage.getMessagesByConversationId(conv.id);
          return { conversation: conv, messages };
        })
      ).then(convs => 
        convs.filter(conv => conv.messages.length >= 10)
      );
      
      if (validConversations.length === 0) {
        throw new Error("Not enough conversation data for fine-tuning");
      }
      
      // Formatter for OpenAI fine-tuning format
      const trainingExamples = [];
      
      for (const { messages } of validConversations) {
        // Group messages into user-assistant pairs
        for (let i = 0; i < messages.length - 1; i++) {
          if (messages[i].role === 'user' && messages[i+1].role === 'assistant') {
            trainingExamples.push({
              messages: [
                { role: "system", content: "You are a helpful AI assistant." },
                { role: "user", content: messages[i].content },
                { role: "assistant", content: messages[i+1].content }
              ]
            });
          }
        }
      }
      
      // Shuffle training examples to avoid biasing towards recent conversations
      const shuffled = trainingExamples.sort(() => 0.5 - Math.random());
      
      // Limit to 100 examples (to control costs and avoid overfitting)
      const limitedExamples = shuffled.slice(0, 100);
      
      // Write to JSONL file
      const fileStream = fs.createWriteStream(filePath);
      for (const example of limitedExamples) {
        fileStream.write(JSON.stringify(example) + '\n');
      }
      
      // Close the file stream
      await new Promise((resolve) => {
        fileStream.end();
        fileStream.on('finish', resolve);
      });
      
      console.log(`Created training file ${filePath} with ${limitedExamples.length} examples`);
      return filePath;
    } catch (error) {
      console.error("Error preparing training data:", error);
      throw error;
    }
  }
  
  /**
   * Start a fine-tuning job with OpenAI
   * @param trainingFilePath Path to the training file
   * @param baseModel Base model to fine-tune (gpt-3.5-turbo or gpt-4-turbo)
   * @returns Job ID
   */
  async startOpenAIFineTuning(trainingFilePath: string, baseModel: string = 'gpt-4o'): Promise<string> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
      }
      
      // Upload the file to OpenAI
      const fileStream = fs.createReadStream(trainingFilePath);
      const fileUpload = await openai.files.create({
        file: fileStream,
        purpose: 'fine-tune'
      });
      
      // Start the fine-tuning job
      const job = await openai.fineTuning.jobs.create({
        training_file: fileUpload.id,
        model: baseModel,
        suffix: `user_ft_${Date.now()}`
      });
      
      console.log(`Started fine-tuning job ${job.id} using ${baseModel}`);
      
      // Store job information
      this.jobs[job.id] = {
        id: job.id,
        model: baseModel,
        status: job.status,
        created_at: Date.now()
      };
      
      return job.id;
    } catch (error) {
      console.error("Error starting OpenAI fine-tuning:", error);
      throw error;
    }
  }
  
  /**
   * Check status of all fine-tuning jobs
   */
  async checkFineTuningJobs(): Promise<void> {
    if (this.isCheckingJobs || !process.env.OPENAI_API_KEY) return;
    
    try {
      this.isCheckingJobs = true;
      
      // Get all jobs from OpenAI
      const response = await openai.fineTuning.jobs.list();
      
      for (const job of response.data) {
        // Update job status in our records
        if (this.jobs[job.id]) {
          this.jobs[job.id].status = job.status;
          
          // If the job has completed, add the model to our list
          if (job.status === 'succeeded' && job.fine_tuned_model) {
            if (!this.models.some(m => m.id === job.fine_tuned_model)) {
              this.models.push({
                id: job.fine_tuned_model,
                created_at: Date.now(),
                fine_tuned_model: job.fine_tuned_model
              });
              
              console.log(`Fine-tuned model ${job.fine_tuned_model} is now available`);
            }
          } else if (job.status === 'failed') {
            console.error(`Fine-tuning job ${job.id} failed:`, job.error);
          }
        } else {
          // Add previously unknown job to our records
          this.jobs[job.id] = {
            id: job.id,
            model: job.model,
            status: job.status,
            created_at: Date.now()
          };
        }
      }
      
      console.log(`Checked ${response.data.length} fine-tuning jobs`);
    } catch (error) {
      console.error("Error checking fine-tuning jobs:", error);
    } finally {
      this.isCheckingJobs = false;
    }
  }
  
  /**
   * Refresh the list of available fine-tuned models
   */
  async refreshAvailableModels(): Promise<void> {
    if (!process.env.OPENAI_API_KEY) return;
    
    try {
      const response = await openai.models.list();
      
      // Filter for fine-tuned models
      const fineTunedModels = response.data.filter(model => 
        model.id.includes('ft-')
      );
      
      // Update our models list
      this.models = fineTunedModels.map(model => ({
        id: model.id,
        created_at: Date.parse(model.created.toString()),
        fine_tuned_model: model.id
      }));
      
      console.log(`Refreshed list of available fine-tuned models: ${this.models.length} models found`);
    } catch (error) {
      console.error("Error refreshing available models:", error);
    }
  }
  
  /**
   * Get all available fine-tuned models
   * @returns List of fine-tuned models
   */
  async listAvailableModels(): Promise<FineTunedModel[]> {
    // If we haven't loaded models yet, load them
    if (this.models.length === 0) {
      await this.refreshAvailableModels();
    }
    
    return this.models;
  }
  
  /**
   * Get all fine-tuning jobs
   * @returns List of fine-tuning jobs
   */
  getJobs(): FineTuningJob[] {
    return Object.values(this.jobs);
  }
  
  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.scheduledJobCheck) {
      clearInterval(this.scheduledJobCheck);
    }
  }
}

// Create a singleton instance
export const fineTuningManager = new FineTuningManager();