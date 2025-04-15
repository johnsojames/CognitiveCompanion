import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { storage } from "./storage";
import { LLMFactory } from "./lib/llm/factory";
import { DocumentProcessor } from "./lib/document/processor";
import { ConversationMemory } from "./lib/memory/conversation";
import { 
  insertUserSchema, 
  insertConversationSchema, 
  insertMessageSchema, 
  insertDocumentSchema,
  insertDocumentConversationLinkSchema,
  insertSettingsSchema,
  messageRoleSchema
} from "@shared/schema";
import { z, ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

// Set up multer storage for document uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, path.join(process.cwd(), 'uploads'));
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Initialize services
const llmFactory = new LLMFactory();
const documentProcessor = new DocumentProcessor();
const conversationMemory = new ConversationMemory(storage);

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Error handling middleware
  const handleErrors = (err: any, res: Response) => {
    console.error("API Error:", err);
    
    if (err instanceof ZodError) {
      // Convert Zod error to a more readable format
      const readableError = fromZodError(err);
      return res.status(400).json({ message: readableError.message });
    }
    
    return res.status(500).json({ 
      message: err.message || "Internal server error" 
    });
  };

  // === Auth routes ===
  
  // Register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);
      
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }
      
      const user = await storage.createUser(userData);
      
      // Create default settings for the new user
      await storage.createOrUpdateSettings({
        userId: user.id,
        defaultModelProvider: "claude",
        defaultModelName: "claude-3-7-sonnet-20250219",
        vectorDbType: "memory",
        memoryLimit: 10
      });
      
      // Don't return the password
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = z.object({
        username: z.string(),
        password: z.string()
      }).parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Don't return the password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // === Conversation routes ===
  
  // Get all conversations for a user
  app.get('/api/conversations', async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const conversations = await storage.getConversationsByUserId(userId);
      res.json(conversations);
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // Get a specific conversation with its messages
  app.get('/api/conversations/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid conversation ID" });
      }
      
      const conversation = await storage.getConversation(id);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      const messages = await storage.getMessagesByConversationId(id);
      const documents = await storage.getDocumentsByConversationId(id);
      
      res.json({
        ...conversation,
        messages,
        documents
      });
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // Create a new conversation
  app.post('/api/conversations', async (req, res) => {
    try {
      const conversationData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(conversationData);
      
      // Add a system message to start the conversation
      await storage.createMessage({
        conversationId: conversation.id,
        role: "system",
        content: `You are ${conversation.modelName}, a helpful AI assistant. You have conversation memory and can access documents.`
      });
      
      res.status(201).json(conversation);
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // Update conversation title
  app.patch('/api/conversations/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title } = z.object({ title: z.string() }).parse(req.body);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid conversation ID" });
      }
      
      const updated = await storage.updateConversationTitle(id, title);
      
      if (!updated) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      res.json(updated);
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // Delete a conversation
  app.delete('/api/conversations/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid conversation ID" });
      }
      
      const success = await storage.deleteConversation(id);
      
      if (!success) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      res.json({ success: true });
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // === Message routes ===
  
  // Add a message and get AI response
  app.post('/api/messages', async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      
      // Validate role
      const validatedRole = messageRoleSchema.parse(messageData.role);
      
      // Get the conversation to determine which model to use
      const conversation = await storage.getConversation(messageData.conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Save the user message
      const userMessage = await storage.createMessage(messageData);
      
      // If the message is from the user, generate an AI response
      if (validatedRole === "user") {
        try {
          // Get conversation history for context
          const messages = await storage.getMessagesByConversationId(messageData.conversationId);
          
          // Get any documents linked to this conversation
          const documents = await storage.getDocumentsByConversationId(messageData.conversationId);
          
          // Get the LLM provider for this conversation
          const llmProvider = llmFactory.getLLMProvider(
            conversation.modelProvider as "claude" | "gpt" | "deepseek",
            conversation.modelName
          );
          
          // Prepare memory context from conversation history
          const memoryContext = await conversationMemory.getConversationContext(
            messageData.conversationId
          );
          
          // Get document contexts if available
          const documentContexts = await Promise.all(
            documents.map(doc => documentProcessor.getDocumentContext(doc.id, doc.filePath))
          );
          
          // Generate the AI response
          const aiResponse = await llmProvider.generateResponse(
            messageData.content,
            memoryContext,
            documentContexts
          );
          
          // Save the AI response
          const assistantMessage = await storage.createMessage({
            conversationId: messageData.conversationId,
            role: "assistant",
            content: aiResponse
          });
          
          // Asynchronously analyze and extract insights from the conversation 
          // to enhance long-term memory (non-blocking)
          setTimeout(() => {
            conversationMemory.extractInsights(messageData.conversationId)
              .catch(err => console.error("Error extracting insights:", err));
          }, 100);

          // If this is the end of a "topic" in the conversation, we might want to trigger
          // a summarization to capture the completed discussion
          const messageCount = messages.length + 2; // +2 for this exchange
          if (messageCount > 0 && messageCount % 10 === 0) {
            // Every 10 messages, trigger a summarization (non-blocking)
            setTimeout(() => {
              conversationMemory.summarizeConversation(messageData.conversationId)
                .catch(err => console.error("Error summarizing conversation:", err));
            }, 100);
          }
          
          // Return both messages
          return res.status(201).json({
            userMessage,
            assistantMessage
          });
        } catch (error) {
          console.error("LLM Error:", error);
          
          // Save error as system message
          const errorMessage = await storage.createMessage({
            conversationId: messageData.conversationId,
            role: "system",
            content: `Error generating response: ${error instanceof Error ? error.message : String(error)}`
          });
          
          return res.status(201).json({
            userMessage,
            errorMessage
          });
        }
      } else {
        // Just return the saved message if it's not from the user
        return res.status(201).json(userMessage);
      }
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // Get messages for a conversation
  app.get('/api/messages', async (req, res) => {
    try {
      const conversationId = parseInt(req.query.conversationId as string);
      
      if (isNaN(conversationId)) {
        return res.status(400).json({ message: "Invalid conversation ID" });
      }
      
      const messages = await storage.getMessagesByConversationId(conversationId);
      res.json(messages);
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // === Document routes ===
  
  // Upload a document
  app.post('/api/documents', upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const userId = parseInt(req.body.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Get file extension
      const fileExt = path.extname(file.originalname).substring(1);
      
      const documentData = insertDocumentSchema.parse({
        title: req.body.title || file.originalname,
        filePath: file.path,
        fileType: fileExt,
        userId: userId,
        fileSize: file.size
      });
      
      const document = await storage.createDocument(documentData);
      
      // Process the document asynchronously
      documentProcessor.processDocument(document.id, document.filePath, document.fileType)
        .then(async () => {
          // Update document status to vectorized
          await storage.updateDocumentVectorized(document.id, true);
        })
        .catch(err => {
          console.error("Error processing document:", err);
        });
      
      res.status(201).json(document);
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // Get all documents for a user
  app.get('/api/documents', async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const documents = await storage.getDocumentsByUserId(userId);
      res.json(documents);
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // Get documents for a conversation
  app.get('/api/conversations/:id/documents', async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      
      if (isNaN(conversationId)) {
        return res.status(400).json({ message: "Invalid conversation ID" });
      }
      
      const documents = await storage.getDocumentsByConversationId(conversationId);
      res.json(documents);
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // Link a document to a conversation
  app.post('/api/document-links', async (req, res) => {
    try {
      const linkData = insertDocumentConversationLinkSchema.parse(req.body);
      
      // Verify both document and conversation exist
      const document = await storage.getDocument(linkData.documentId);
      const conversation = await storage.getConversation(linkData.conversationId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      const link = await storage.createDocumentConversationLink(linkData);
      res.status(201).json(link);
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // Unlink a document from a conversation
  app.delete('/api/document-links/:documentId/:conversationId', async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const conversationId = parseInt(req.params.conversationId);
      
      if (isNaN(documentId) || isNaN(conversationId)) {
        return res.status(400).json({ message: "Invalid IDs" });
      }
      
      const success = await storage.removeDocumentConversationLink(documentId, conversationId);
      
      if (!success) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      res.json({ success: true });
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // === Memory routes ===
  
  // Get all memory for a user
  app.get('/api/memory/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const memory = await conversationMemory.getUserMemory(userId);
      res.json(memory);
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // Get a specific memory entry by type and key
  app.get('/api/memory/:userId/:type/:key', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { type, key } = req.params;
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const memoryEntry = await storage.getMemoryEntryByKey(userId, key, type);
      
      if (!memoryEntry) {
        return res.status(404).json({ message: "Memory entry not found" });
      }
      
      res.json(memoryEntry);
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // Store a user preference explicitly
  app.post('/api/memory/preference', async (req, res) => {
    try {
      const { userId, key, value, importance } = req.body;
      
      if (!userId || !key || !value) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      await conversationMemory.storeUserPreference(
        parseInt(userId), 
        key, 
        value, 
        importance ? parseInt(importance) : undefined
      );
      
      res.json({ success: true });
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // === Settings routes ===
  
  // Get settings for a user
  app.get('/api/settings/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const settings = await storage.getSettingsByUserId(userId);
      
      if (!settings) {
        return res.status(404).json({ message: "Settings not found" });
      }
      
      res.json(settings);
    } catch (err) {
      handleErrors(err, res);
    }
  });
  
  // Update settings for a user
  app.post('/api/settings', async (req, res) => {
    try {
      const settingsData = insertSettingsSchema.parse(req.body);
      const settings = await storage.createOrUpdateSettings(settingsData);
      res.json(settings);
    } catch (err) {
      handleErrors(err, res);
    }
  });

  return httpServer;
}
