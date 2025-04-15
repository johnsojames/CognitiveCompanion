import { 
  users, type User, type InsertUser,
  conversations, type Conversation, type InsertConversation,
  messages, type Message, type InsertMessage,
  documents, type Document, type InsertDocument,
  documentConversationLinks, type DocumentConversationLink, type InsertDocumentConversationLink,
  settings, type Settings, type InsertSettings,
  type ModelProvider
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Conversation operations
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationsByUserId(userId: number): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversationTitle(id: number, title: string): Promise<Conversation | undefined>;
  deleteConversation(id: number): Promise<boolean>;
  
  // Message operations
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesByConversationId(conversationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Document operations
  getDocument(id: number): Promise<Document | undefined>;
  getDocumentsByUserId(userId: number): Promise<Document[]>;
  getDocumentsByConversationId(conversationId: number): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocumentVectorized(id: number, vectorized: boolean): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;
  
  // Document Conversation Link operations
  createDocumentConversationLink(link: InsertDocumentConversationLink): Promise<DocumentConversationLink>;
  removeDocumentConversationLink(documentId: number, conversationId: number): Promise<boolean>;
  
  // Settings operations
  getSettingsByUserId(userId: number): Promise<Settings | undefined>;
  createOrUpdateSettings(settings: InsertSettings): Promise<Settings>;
  getDefaultModelByUserId(userId: number): Promise<{provider: ModelProvider, name: string} | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  private documents: Map<number, Document>;
  private documentConversationLinks: Map<number, DocumentConversationLink>;
  private settings: Map<number, Settings>;
  
  private userId: number = 1;
  private conversationId: number = 1;
  private messageId: number = 1;
  private documentId: number = 1;
  private linkId: number = 1;
  private settingsId: number = 1;
  
  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.documents = new Map();
    this.documentConversationLinks = new Map();
    this.settings = new Map();
    
    // Initialize with a demo user
    this.createUser({
      username: "admin",
      password: "admin",
      displayName: "Admin"
    });
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const now = new Date();
    const user: User = { 
      ...insertUser, 
      id, 
      role: "user",
      createdAt: now
    };
    this.users.set(id, user);
    return user;
  }
  
  // Conversation operations
  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }
  
  async getConversationsByUserId(userId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(
      (conversation) => conversation.userId === userId,
    ).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  
  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = this.conversationId++;
    const now = new Date();
    const conversation: Conversation = {
      ...insertConversation,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(id, conversation);
    return conversation;
  }
  
  async updateConversationTitle(id: number, title: string): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;
    
    const updated: Conversation = {
      ...conversation,
      title,
      updatedAt: new Date(),
    };
    this.conversations.set(id, updated);
    return updated;
  }
  
  async deleteConversation(id: number): Promise<boolean> {
    if (!this.conversations.has(id)) return false;
    
    // Delete all related messages
    for (const message of this.messages.values()) {
      if (message.conversationId === id) {
        this.messages.delete(message.id);
      }
    }
    
    // Delete all related document links
    for (const link of this.documentConversationLinks.values()) {
      if (link.conversationId === id) {
        this.documentConversationLinks.delete(link.id);
      }
    }
    
    return this.conversations.delete(id);
  }
  
  // Message operations
  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }
  
  async getMessagesByConversationId(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.messageId++;
    const message: Message = {
      ...insertMessage,
      id,
      timestamp: new Date(),
    };
    this.messages.set(id, message);
    
    // Update the conversation updatedAt time
    const conversation = this.conversations.get(insertMessage.conversationId);
    if (conversation) {
      this.conversations.set(conversation.id, {
        ...conversation,
        updatedAt: new Date(),
      });
    }
    
    return message;
  }
  
  // Document operations
  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }
  
  async getDocumentsByUserId(userId: number): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter((document) => document.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async getDocumentsByConversationId(conversationId: number): Promise<Document[]> {
    // Get all link IDs for this conversation
    const linkDocIds = Array.from(this.documentConversationLinks.values())
      .filter((link) => link.conversationId === conversationId)
      .map((link) => link.documentId);
    
    // Return the documents that have links to this conversation
    return Array.from(this.documents.values())
      .filter((document) => linkDocIds.includes(document.id));
  }
  
  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = this.documentId++;
    const document: Document = {
      ...insertDocument,
      id,
      vectorized: false,
      createdAt: new Date(),
    };
    this.documents.set(id, document);
    return document;
  }
  
  async updateDocumentVectorized(id: number, vectorized: boolean): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;
    
    const updated: Document = {
      ...document,
      vectorized,
    };
    this.documents.set(id, updated);
    return updated;
  }
  
  async deleteDocument(id: number): Promise<boolean> {
    if (!this.documents.has(id)) return false;
    
    // Delete all related document conversation links
    for (const link of this.documentConversationLinks.values()) {
      if (link.documentId === id) {
        this.documentConversationLinks.delete(link.id);
      }
    }
    
    return this.documents.delete(id);
  }
  
  // Document Conversation Link operations
  async createDocumentConversationLink(insertLink: InsertDocumentConversationLink): Promise<DocumentConversationLink> {
    // Check if the link already exists
    const existingLink = Array.from(this.documentConversationLinks.values()).find(
      (link) => link.documentId === insertLink.documentId && 
                link.conversationId === insertLink.conversationId
    );
    
    if (existingLink) return existingLink;
    
    const id = this.linkId++;
    const link: DocumentConversationLink = {
      ...insertLink,
      id,
      createdAt: new Date(),
    };
    this.documentConversationLinks.set(id, link);
    return link;
  }
  
  async removeDocumentConversationLink(documentId: number, conversationId: number): Promise<boolean> {
    const link = Array.from(this.documentConversationLinks.values()).find(
      (l) => l.documentId === documentId && l.conversationId === conversationId
    );
    
    if (!link) return false;
    return this.documentConversationLinks.delete(link.id);
  }
  
  // Settings operations
  async getSettingsByUserId(userId: number): Promise<Settings | undefined> {
    return Array.from(this.settings.values()).find(
      (s) => s.userId === userId
    );
  }
  
  async createOrUpdateSettings(insertSettings: InsertSettings): Promise<Settings> {
    let existingSettings = await this.getSettingsByUserId(insertSettings.userId);
    
    if (existingSettings) {
      const updated: Settings = {
        ...existingSettings,
        ...insertSettings,
      };
      this.settings.set(existingSettings.id, updated);
      return updated;
    }
    
    const id = this.settingsId++;
    const settings: Settings = {
      ...insertSettings,
      id,
    };
    this.settings.set(id, settings);
    return settings;
  }
  
  async getDefaultModelByUserId(userId: number): Promise<{provider: ModelProvider, name: string} | undefined> {
    const settings = await this.getSettingsByUserId(userId);
    if (!settings) return undefined;
    
    return {
      provider: settings.defaultModelProvider as ModelProvider,
      name: settings.defaultModelName,
    };
  }
}

export const storage = new MemStorage();
