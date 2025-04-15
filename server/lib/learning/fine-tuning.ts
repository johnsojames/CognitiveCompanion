import { storage } from "../../storage";
import type { Message, Conversation, User } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// Initialize API clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Directory to store fine-tuning files
const DATA_DIR = path.join(process.cwd(), 'data', 'fine-tuning');

/**
 * Fine-tuning manager that prepares data and initiates fine-tuning jobs
 */
export class FineTuningManager {
  constructor() {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  /**
   * Prepare conversation data for fine-tuning
   * @param userId User ID to prepare data for, or undefined for all users
   * @param minMessages Minimum number of messages a conversation must have to be included
   * @returns Path to the prepared JSONL file
   */
  async prepareTrainingData(userId?: number, minMessages: number = 10): Promise<string> {
    try {
      console.log("Preparing fine-tuning data...");
      
      // Get all conversations, optionally filtered by user
      let conversations: Conversation[] = [];
      if (userId) {
        conversations = await storage.getConversationsByUserId(userId);
      } else {
        // This would need implementation to get all conversations
        // For now, we'll just aggregate user conversations
        const users = await this.getAllUsers();
        for (const user of users) {
          const userConversations = await storage.getConversationsByUserId(user.id);
          conversations.push(...userConversations);
        }
      }
      
      // Prepare training examples
      const trainingExamples = [];
      
      for (const conversation of conversations) {
        // Get all messages for this conversation
        const messages = await storage.getMessagesByConversationId(conversation.id);
        
        // Skip conversations with too few messages
        if (messages.length < minMessages) continue;
        
        // Filter out system messages
        const userAssistantMessages = messages.filter(m => m.role === "user" || m.role === "assistant");
        
        // Process the conversation into training examples
        for (let i = 0; i < userAssistantMessages.length - 1; i += 2) {
          const userMsg = userAssistantMessages[i];
          const assistantMsg = userAssistantMessages[i + 1];
          
          // Skip if we don't have a proper user-assistant pair
          if (!userMsg || !assistantMsg || userMsg.role !== "user" || assistantMsg.role !== "assistant") continue;
          
          // Create a training example
          trainingExamples.push({
            messages: [
              { role: "system", content: "You are a helpful AI assistant with access to user documents and memory of past conversations." },
              { role: "user", content: userMsg.content },
              { role: "assistant", content: assistantMsg.content }
            ]
          });
        }
      }
      
      // Save to JSONL file
      const timestamp = Date.now();
      const userSuffix = userId ? `_user_${userId}` : "_all_users";
      const outputPath = path.join(DATA_DIR, `training_data_${timestamp}${userSuffix}.jsonl`);
      
      const jsonlContent = trainingExamples.map(example => JSON.stringify(example)).join("\n");
      fs.writeFileSync(outputPath, jsonlContent);
      
      console.log(`Training data prepared: ${trainingExamples.length} examples saved to ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error("Error preparing training data:", error);
      throw error;
    }
  }
  
  /**
   * Start a fine-tuning job with OpenAI
   * @param trainingFilePath Path to the JSONL training file
   * @param modelName Base model to fine-tune, defaults to gpt-4o
   * @returns ID of the created fine-tuning job
   */
  async startOpenAIFineTuning(trainingFilePath: string, modelName: string = "gpt-4o"): Promise<string> {
    try {
      console.log(`Starting OpenAI fine-tuning job using ${trainingFilePath}...`);
      
      // Upload the file
      const file = await openai.files.create({
        file: fs.createReadStream(trainingFilePath),
        purpose: "fine-tune",
      });
      
      // Create the fine-tuning job
      const fineTuningJob = await openai.fineTuning.jobs.create({
        training_file: file.id,
        model: modelName,
        suffix: `ft-rag-assistant-${Date.now()}`,
      });
      
      console.log(`Fine-tuning job created: ${fineTuningJob.id}`);
      return fineTuningJob.id;
    } catch (error) {
      console.error("Error starting OpenAI fine-tuning:", error);
      throw error;
    }
  }
  
  /**
   * Check the status of an OpenAI fine-tuning job
   * @param jobId ID of the fine-tuning job
   * @returns Current status of the job
   */
  async checkOpenAIFineTuningStatus(jobId: string): Promise<any> {
    try {
      const job = await openai.fineTuning.jobs.retrieve(jobId);
      return job;
    } catch (error) {
      console.error("Error checking fine-tuning status:", error);
      throw error;
    }
  }
  
  /**
   * List all available models, including fine-tuned ones
   * @returns Array of model objects
   */
  async listAvailableModels(): Promise<any[]> {
    try {
      const openaiModels = await openai.models.list();
      // Filter to include only fine-tuned models
      const fineTunedModels = openaiModels.data.filter(model => model.id.includes("ft-"));
      
      return fineTunedModels;
    } catch (error) {
      console.error("Error listing models:", error);
      throw error;
    }
  }
  
  /**
   * Get all users in the system
   * @private
   */
  private async getAllUsers(): Promise<User[]> {
    // This would need to be implemented based on your storage system
    // For now, we'll return a mock implementation
    const users: User[] = [];
    // In a real implementation, you would query your database for all users
    return users;
  }
  
  /**
   * Schedule regular fine-tuning jobs
   * @param intervalDays How often to run fine-tuning in days
   */
  scheduleRegularFineTuning(intervalDays: number = 7): void {
    // Convert days to milliseconds
    const interval = intervalDays * 24 * 60 * 60 * 1000;
    
    setInterval(async () => {
      try {
        console.log("Running scheduled fine-tuning job...");
        const trainingData = await this.prepareTrainingData();
        await this.startOpenAIFineTuning(trainingData);
      } catch (error) {
        console.error("Error in scheduled fine-tuning:", error);
      }
    }, interval);
    
    console.log(`Scheduled fine-tuning to run every ${intervalDays} days`);
  }
}

export const fineTuningManager = new FineTuningManager();