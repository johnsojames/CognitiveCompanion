import { pgTable, text, serial, integer, boolean, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User data
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  role: text("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
});

// Conversations
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  userId: integer("user_id").notNull(),
  modelProvider: text("model_provider").notNull(), // claude, gpt, deepseek
  modelName: text("model_name").notNull(), // specific model name
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  title: true,
  userId: true,
  modelProvider: true,
  modelName: true,
});

// Messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(), // user, assistant, system
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  role: true,
  content: true,
});

// Documents
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type").notNull(), // pdf, md, txt, etc.
  userId: integer("user_id").notNull(),
  fileSize: integer("file_size").notNull(),
  vectorized: boolean("vectorized").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  title: true,
  filePath: true,
  fileType: true,
  userId: true,
  fileSize: true,
});

// Document Conversation Links
export const documentConversationLinks = pgTable("document_conversation_links", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  conversationId: integer("conversation_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDocumentConversationLinkSchema = createInsertSchema(documentConversationLinks).pick({
  documentId: true,
  conversationId: true,
});

// Settings
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  defaultModelProvider: text("default_model_provider").default("claude").notNull(),
  defaultModelName: text("default_model_name").default("claude-3-7-sonnet-20250219").notNull(),
  vectorDbType: text("vector_db_type").default("memory").notNull(),
  memoryLimit: integer("memory_limit").default(10).notNull(), // in GB
});

export const insertSettingsSchema = createInsertSchema(settings).pick({
  userId: true,
  defaultModelProvider: true,
  defaultModelName: true,
  vectorDbType: true,
  memoryLimit: true,
});

// Document Chunks
export const documentChunks = pgTable("document_chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").notNull(),
  embedding: text("embedding"), // Stored as a string representation of vector
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDocumentChunkSchema = createInsertSchema(documentChunks).pick({
  documentId: true,
  chunkIndex: true,
  content: true,
  metadata: true,
  embedding: true,
});

// Model types

export const modelProviders = ["claude", "gpt", "deepseek"] as const;
export const modelProviderSchema = z.enum(modelProviders);
export type ModelProvider = z.infer<typeof modelProviderSchema>;

export const messageRoles = ["user", "assistant", "system"] as const;
export const messageRoleSchema = z.enum(messageRoles);
export type MessageRole = z.infer<typeof messageRoleSchema>;

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type DocumentConversationLink = typeof documentConversationLinks.$inferSelect;
export type InsertDocumentConversationLink = z.infer<typeof insertDocumentConversationLinkSchema>;

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;

// Memory system
export const memoryEntries = pgTable("memory_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  conversationId: integer("conversation_id").references(() => conversations.id),
  type: text("type").notNull(), // "preference", "summary", "insight"
  key: text("key").notNull(),
  value: text("value").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  importance: integer("importance").default(1), // 1-10 scale for memory importance
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertMemoryEntrySchema = createInsertSchema(memoryEntries).pick({
  userId: true,
  conversationId: true,
  type: true,
  key: true,
  value: true,
  importance: true
});

export type MemoryEntry = typeof memoryEntries.$inferSelect;
export type InsertMemoryEntry = z.infer<typeof insertMemoryEntrySchema>;
