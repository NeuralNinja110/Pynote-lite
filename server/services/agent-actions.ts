import { storage } from "../storage";
import { pythonExecutor } from "./python-executor";
import { NotebookCell } from "@shared/schema";

export interface AgentAction {
  type: string;
  data: any;
}

export class AgentActionExecutor {
  async executeActions(actions: AgentAction[], fileId?: string): Promise<any[]> {
    const results = [];
    
    for (const action of actions) {
      try {
        const result = await this.executeAction(action, fileId);
        results.push({ success: true, action: action.type, result });
      } catch (error) {
        results.push({ 
          success: false, 
          action: action.type, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
    
    return results;
  }

  private async executeAction(action: AgentAction, fileId?: string): Promise<any> {
    switch (action.type) {
      case 'create_cell':
        return this.createCell(action.data, fileId);
      case 'update_cell':
        return this.updateCell(action.data);
      case 'delete_cell':
        return this.deleteCell(action.data.cellId);
      case 'execute_cell':
        return this.executeCell(action.data);
      case 'install_package':
        return this.installPackage(action.data.package);
      case 'update_requirements':
        return this.updateRequirements(action.data.content);
      case 'create_file':
        return this.createFile(action.data);
      case 'run_all_cells':
        return this.runAllCells(fileId);
      case 'fix_error':
        return this.fixError(action.data, fileId);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async createCell(data: { type: string; content: string; order?: number }, fileId?: string) {
    if (!fileId) throw new Error('File ID required for creating cells');
    
    const cells = await storage.getCellsByFileId(fileId);
    const order = data.order ?? cells.length;
    
    return await storage.createCell({
      fileId,
      type: data.type,
      content: data.content,
      order,
    });
  }

  private async updateCell(data: { cellId: string; content: string }) {
    return await storage.updateCell(data.cellId, data.content);
  }

  private async deleteCell(cellId: string) {
    return await storage.deleteCell(cellId);
  }

  private async executeCell(data: { cellId: string; content?: string }) {
    const cell = await storage.updateCell(data.cellId, data.content || "");
    if (!cell) throw new Error('Cell not found');

    if (cell.type === 'python') {
      const result = await pythonExecutor.executeCell(cell.id, cell.content);
      const output = result.success ? result.output : result.error;
      await storage.updateCell(cell.id, cell.content, output);
      return result;
    } else {
      // Markdown cell
      await storage.updateCell(cell.id, cell.content, cell.content);
      return { success: true, output: cell.content };
    }
  }

  private async installPackage(packageName: string) {
    const tempCode = `!pip install ${packageName}`;
    return await pythonExecutor.executeCell('temp-install', tempCode);
  }

  private async updateRequirements(content: string) {
    // Find requirements.txt file
    const files = await storage.getFiles();
    const requirementsFile = files.find(f => f.name === 'requirements.txt');
    
    if (requirementsFile) {
      await storage.updateFile(requirementsFile.id, content);
      return await pythonExecutor.installRequirements(content);
    } else {
      // Create requirements.txt if it doesn't exist
      const newFile = await storage.createFile({
        name: 'requirements.txt',
        type: 'txt',
        content,
      });
      return await pythonExecutor.installRequirements(content);
    }
  }

  private async createFile(data: { name: string; type: string; content: string }) {
    return await storage.createFile(data);
  }

  private async runAllCells(fileId?: string) {
    if (!fileId) throw new Error('File ID required for running all cells');
    
    const cells = await storage.getCellsByFileId(fileId);
    const results = [];
    
    for (const cell of cells.filter(c => c.type === 'python')) {
      const result = await this.executeCell({ cellId: cell.id, content: cell.content });
      results.push(result);
    }
    
    return results;
  }

  private async fixError(data: { cellId: string; error: string; originalCode: string }, fileId?: string) {
    // This is a placeholder for error fixing logic
    // In a real implementation, you'd analyze the error and suggest fixes
    const fixedCode = this.generateErrorFix(data.error, data.originalCode);
    
    await this.updateCell({ cellId: data.cellId, content: fixedCode });
    return await this.executeCell({ cellId: data.cellId, content: fixedCode });
  }

  private generateErrorFix(error: string, originalCode: string): string {
    // Simple error fix examples - in reality, this would be more sophisticated
    let fixedCode = originalCode;
    
    if (error.includes('ModuleNotFoundError')) {
      const match = error.match(/No module named '(.+?)'/);
      if (match) {
        const module = match[1];
        fixedCode = `!pip install ${module}\n${originalCode}`;
      }
    } else if (error.includes('NameError')) {
      const match = error.match(/name '(.+?)' is not defined/);
      if (match) {
        const varName = match[1];
        if (varName === 'np') {
          fixedCode = `import numpy as np\n${originalCode}`;
        } else if (varName === 'pd') {
          fixedCode = `import pandas as pd\n${originalCode}`;
        } else if (varName === 'plt') {
          fixedCode = `import matplotlib.pyplot as plt\n${originalCode}`;
        }
      }
    } else if (error.includes('IndentationError')) {
      // Fix common indentation issues
      fixedCode = originalCode.split('\n').map(line => line.trimStart()).join('\n');
    }
    
    return fixedCode;
  }
}

export const agentActionExecutor = new AgentActionExecutor();