import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'py', 'txt', 'png', 'jpg', 'jpeg', 'webp'
  content: text("content"), // For text files
  base64Data: text("base64_data"), // For binary files (base64 encoded)
  createdAt: timestamp("created_at").defaultNow(),
});

export const notebookCells = pgTable("notebook_cells", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileId: varchar("file_id").notNull().references(() => files.id),
  type: text("type").notNull(), // 'python' or 'markdown'
  content: text("content").notNull(),
  output: text("output"),
  order: integer("order").notNull(),
  executed: boolean("executed").default(false),
});

export const copilotSessions = pgTable("copilot_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull(), // 'gemini' or 'openrouter'
  model: text("model").notNull(),
  mode: text("mode").notNull(), // 'ask' or 'agent'
  usageMode: text("usage_mode").notNull(), // 'free' or 'restrictive'
  context: jsonb("context"), // Knowledge graph context
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => copilotSessions.id),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertFileSchema = createInsertSchema(files).pick({
  name: true,
  type: true,
  content: true,
  base64Data: true,
});

export const insertNotebookCellSchema = createInsertSchema(notebookCells).pick({
  fileId: true,
  type: true,
  content: true,
  order: true,
});

export const insertCopilotSessionSchema = createInsertSchema(copilotSessions).pick({
  provider: true,
  model: true,
  mode: true,
  usageMode: true,
  context: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  sessionId: true,
  role: true,
  content: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;
export type InsertNotebookCell = z.infer<typeof insertNotebookCellSchema>;
export type NotebookCell = typeof notebookCells.$inferSelect;
export type InsertCopilotSession = z.infer<typeof insertCopilotSessionSchema>;
export type CopilotSession = typeof copilotSessions.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
