import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { pythonExecutor } from "./services/python-executor";
import { aiService } from "./services/ai-service";
import { agentActionExecutor } from "./services/agent-actions";
import { insertFileSchema, insertNotebookCellSchema, insertCopilotSessionSchema, insertChatMessageSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // File management routes
  app.get("/api/files", async (req, res) => {
    try {
      const files = await storage.getFiles();
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  app.get("/api/files/:id", async (req, res) => {
    try {
      const file = await storage.getFile(req.params.id);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json(file);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch file" });
    }
  });

  app.post("/api/files", async (req, res) => {
    try {
      const validatedData = insertFileSchema.parse(req.body);
      const file = await storage.createFile(validatedData);
      res.json(file);
    } catch (error) {
      res.status(400).json({ error: "Invalid file data" });
    }
  });

  app.put("/api/files/:id", async (req, res) => {
    try {
      const { content } = req.body;
      const file = await storage.updateFile(req.params.id, content);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // If updating requirements.txt, install packages
      if (file.name === "requirements.txt") {
        try {
          const result = await pythonExecutor.installRequirements(content);
          if (!result.success) {
            console.warn("Requirements installation failed:", result.error);
            // Don't fail the file save, just warn
          }
        } catch (error) {
          console.warn("Requirements installation error:", error);
          // Don't fail the file save, just warn
        }
      }
      
      res.json(file);
    } catch (error) {
      res.status(500).json({ error: "Failed to update file" });
    }
  });

  app.delete("/api/files/:id", async (req, res) => {
    try {
      const success = await storage.deleteFile(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Notebook cell routes
  app.get("/api/files/:fileId/cells", async (req, res) => {
    try {
      const cells = await storage.getCellsByFileId(req.params.fileId);
      res.json(cells);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cells" });
    }
  });

  app.post("/api/files/:fileId/cells", async (req, res) => {
    try {
      const validatedData = insertNotebookCellSchema.parse({
        ...req.body,
        fileId: req.params.fileId,
      });
      const cell = await storage.createCell(validatedData);
      res.json(cell);
    } catch (error) {
      res.status(400).json({ error: "Invalid cell data" });
    }
  });

  app.put("/api/cells/:id", async (req, res) => {
    try {
      const { content } = req.body;
      const cell = await storage.updateCell(req.params.id, content);
      if (!cell) {
        return res.status(404).json({ error: "Cell not found" });
      }
      res.json(cell);
    } catch (error) {
      res.status(500).json({ error: "Failed to update cell" });
    }
  });

  app.post("/api/cells/:id/execute", async (req, res) => {
    try {
      const cell = await storage.updateCell(req.params.id, req.body.content);
      if (!cell) {
        return res.status(404).json({ error: "Cell not found" });
      }

      if (cell.type === "python") {
        const result = await pythonExecutor.executeCell(cell.id, cell.content);
        const output = result.success ? result.output : result.error;
        
        await storage.updateCell(cell.id, cell.content, output);
        
        res.json({
          ...result,
          cellId: cell.id,
          output,
        });
      } else if (cell.type === "markdown") {
        // For markdown cells, render markdown content
        const renderedMarkdown = cell.content;
        await storage.updateCell(cell.id, cell.content, renderedMarkdown);
        res.json({
          success: true,
          output: renderedMarkdown,
          cellId: cell.id,
          executionTime: 0,
        });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to execute cell" });
    }
  });

  app.delete("/api/cells/:id", async (req, res) => {
    try {
      const success = await storage.deleteCell(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Cell not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete cell" });
    }
  });

  // Execution control routes
  app.post("/api/execution/stop", async (req, res) => {
    try {
      pythonExecutor.stopAllExecution();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop execution" });
    }
  });

  app.post("/api/execution/stop/:cellId", async (req, res) => {
    try {
      const success = pythonExecutor.stopExecution(req.params.cellId);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop cell execution" });
    }
  });

  // Download routes
  app.get("/api/files/:fileId/download/py", async (req, res) => {
    try {
      const cells = await storage.getCellsByFileId(req.params.fileId);
      const pythonCode = pythonExecutor.generateNotebookPy(cells);
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="notebook.py"');
      res.send(pythonCode);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate Python file" });
    }
  });

  app.get("/api/files/:fileId/download/ipynb", async (req, res) => {
    try {
      const cells = await storage.getCellsByFileId(req.params.fileId);
      const cellsForExport = cells.map(cell => ({
        type: cell.type,
        content: cell.content,
        output: cell.output || undefined
      }));
      const ipynbContent = pythonExecutor.generateNotebookIpynb(cellsForExport);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="notebook.ipynb"');
      res.send(ipynbContent);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate Jupyter notebook" });
    }
  });

  // AI Copilot routes
  app.get("/api/ai/providers", async (req, res) => {
    try {
      const providers = aiService.getAvailableProviders();
      const providerDetails = providers.map(name => {
        const provider = aiService.getProvider(name);
        return {
          name,
          models: provider?.models || []
        };
      });
      res.json(providerDetails);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch providers" });
    }
  });

  app.post("/api/copilot/sessions", async (req, res) => {
    try {
      const validatedData = insertCopilotSessionSchema.parse(req.body);
      const session = await storage.createCopilotSession(validatedData);
      res.json(session);
    } catch (error) {
      res.status(400).json({ error: "Invalid session data" });
    }
  });

  app.get("/api/copilot/sessions/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getChatMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/copilot/sessions/:sessionId/chat", async (req, res) => {
    try {
      const { message, cells, fileId, apiKey } = req.body;
      const sessionId = req.params.sessionId;
      
      const session = await storage.getCopilotSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Set API key for the provider if provided
      if (apiKey) {
        aiService.setApiKey(session.provider, apiKey);
      }

      // Store user message
      await storage.createChatMessage({
        sessionId,
        role: "user",
        content: message,
      });

      // Build context prompt
      const contextPrompt = aiService.buildContextPrompt(session.mode, cells || [], message);
      
      // Generate AI response
      const aiResponse = await aiService.generateResponse(
        session.provider,
        session.model,
        contextPrompt,
        session.context
      );

      let finalResponse = aiResponse;
      let actionResults = [];

      // If agent mode, try to parse and execute actions
      if (session.mode === "agent") {
        try {
          // Clean the response - remove markdown code blocks if present
          let cleanResponse = aiResponse.trim();
          if (cleanResponse.startsWith('```json')) {
            cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          }
          if (cleanResponse.startsWith('```')) {
            cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          
          const parsedResponse = JSON.parse(cleanResponse);
          if (parsedResponse.actions && Array.isArray(parsedResponse.actions)) {
            actionResults = await agentActionExecutor.executeActions(parsedResponse.actions, fileId);
            finalResponse = `${parsedResponse.message || "Actions executed"}\n\nActions performed:\n${actionResults.map(r => `- ${r.action}: ${r.success ? "✓" : "✗"} ${r.error || ""}`).join("\n")}`;
          } else {
            // No actions, just use the message
            finalResponse = parsedResponse.message || aiResponse;
          }
        } catch (error) {
          // If parsing fails, treat as regular response
          console.warn("Failed to parse agent response as JSON:", error);
          finalResponse = aiResponse;
        }
      }

      // Store AI response
      const assistantMessage = await storage.createChatMessage({
        sessionId,
        role: "assistant",
        content: finalResponse,
      });

      res.json({ ...assistantMessage, actionResults });
    } catch (error) {
      res.status(500).json({ error: `Failed to generate response: ${error}` });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
