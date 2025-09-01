import { type User, type InsertUser, type File, type InsertFile, type NotebookCell, type InsertNotebookCell, type CopilotSession, type InsertCopilotSession, type ChatMessage, type InsertChatMessage } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // File operations
  getFiles(): Promise<File[]>;
  getFile(id: string): Promise<File | undefined>;
  createFile(file: InsertFile): Promise<File>;
  updateFile(id: string, content: string): Promise<File | undefined>;
  deleteFile(id: string): Promise<boolean>;
  
  // Notebook cell operations
  getCellsByFileId(fileId: string): Promise<NotebookCell[]>;
  createCell(cell: InsertNotebookCell): Promise<NotebookCell>;
  updateCell(id: string, content: string, output?: string): Promise<NotebookCell | undefined>;
  updateCellOrder(id: string, order: number): Promise<NotebookCell | undefined>;
  deleteCell(id: string): Promise<boolean>;
  
  // Copilot operations
  createCopilotSession(session: InsertCopilotSession): Promise<CopilotSession>;
  getCopilotSession(id: string): Promise<CopilotSession | undefined>;
  updateCopilotSession(id: string, context: any): Promise<CopilotSession | undefined>;
  
  // Chat operations
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private files: Map<string, File>;
  private cells: Map<string, NotebookCell>;
  private sessions: Map<string, CopilotSession>;
  private messages: Map<string, ChatMessage>;

  constructor() {
    this.users = new Map();
    this.files = new Map();
    this.cells = new Map();
    this.sessions = new Map();
    this.messages = new Map();
    
    // Initialize with requirements.txt
    const requirementsFile: File = {
      id: randomUUID(),
      name: "requirements.txt",
      type: "txt",
      content: "# Add your Python dependencies here\n# Example:\n# pandas==1.5.0\n# matplotlib==3.6.0\n# numpy==1.24.0",
      base64Data: null,
      createdAt: new Date(),
    };
    this.files.set(requirementsFile.id, requirementsFile);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getFiles(): Promise<File[]> {
    return Array.from(this.files.values()).sort((a, b) => 
      a.createdAt!.getTime() - b.createdAt!.getTime()
    );
  }

  async getFile(id: string): Promise<File | undefined> {
    return this.files.get(id);
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const id = randomUUID();
    const file: File = { 
      ...insertFile, 
      id, 
      content: insertFile.content || null,
      base64Data: insertFile.base64Data || null,
      createdAt: new Date() 
    };
    this.files.set(id, file);
    return file;
  }

  async updateFile(id: string, content: string): Promise<File | undefined> {
    const file = this.files.get(id);
    if (file) {
      const updatedFile = { ...file, content };
      this.files.set(id, updatedFile);
      return updatedFile;
    }
    return undefined;
  }

  async deleteFile(id: string): Promise<boolean> {
    return this.files.delete(id);
  }

  async getCellsByFileId(fileId: string): Promise<NotebookCell[]> {
    return Array.from(this.cells.values())
      .filter(cell => cell.fileId === fileId)
      .sort((a, b) => a.order - b.order);
  }

  async createCell(insertCell: InsertNotebookCell): Promise<NotebookCell> {
    const id = randomUUID();
    const cell: NotebookCell = { 
      ...insertCell, 
      id, 
      output: null,
      executed: false
    };
    this.cells.set(id, cell);
    return cell;
  }

  async updateCell(id: string, content: string, output?: string): Promise<NotebookCell | undefined> {
    const cell = this.cells.get(id);
    if (cell) {
      const updatedCell = { 
        ...cell, 
        content, 
        output: output ?? cell.output,
        executed: output !== undefined ? true : cell.executed
      };
      this.cells.set(id, updatedCell);
      return updatedCell;
    }
    return undefined;
  }

  async updateCellOrder(id: string, order: number): Promise<NotebookCell | undefined> {
    const cell = this.cells.get(id);
    if (cell) {
      const updatedCell = { ...cell, order };
      this.cells.set(id, updatedCell);
      return updatedCell;
    }
    return undefined;
  }

  async deleteCell(id: string): Promise<boolean> {
    return this.cells.delete(id);
  }

  async createCopilotSession(insertSession: InsertCopilotSession): Promise<CopilotSession> {
    const id = randomUUID();
    const session: CopilotSession = { 
      ...insertSession, 
      id, 
      context: insertSession.context || null,
      createdAt: new Date() 
    };
    this.sessions.set(id, session);
    return session;
  }

  async getCopilotSession(id: string): Promise<CopilotSession | undefined> {
    return this.sessions.get(id);
  }

  async updateCopilotSession(id: string, context: any): Promise<CopilotSession | undefined> {
    const session = this.sessions.get(id);
    if (session) {
      const updatedSession = { ...session, context };
      this.sessions.set(id, updatedSession);
      return updatedSession;
    }
    return undefined;
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return Array.from(this.messages.values())
      .filter(message => message.sessionId === sessionId)
      .sort((a, b) => a.timestamp!.getTime() - b.timestamp!.getTime());
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const message: ChatMessage = { 
      ...insertMessage, 
      id, 
      timestamp: new Date() 
    };
    this.messages.set(id, message);
    return message;
  }
}

export const storage = new MemStorage();
