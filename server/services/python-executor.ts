import { spawn, ChildProcess } from "child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export interface ExecutionResult {
  output: string;
  error: string;
  success: boolean;
  executionTime: number;
  isWaitingForInput?: boolean;
  inputPrompt?: string;
}

export interface ExecutionSession {
  process: ChildProcess;
  output: string;
  error: string;
  startTime: number;
  isWaitingForInput: boolean;
  inputPrompt: string;
}

export class PythonExecutor {
  private workingDir: string;
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private executionSessions: Map<string, ExecutionSession> = new Map();

  constructor() {
    this.workingDir = join(process.cwd(), "python_workspace");
    if (!existsSync(this.workingDir)) {
      mkdirSync(this.workingDir, { recursive: true });
    }
  }

  async executeCell(cellId: string, code: string): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    // Check if code contains input() statements
    const hasInput = /\binput\s*\(/.test(code);
    
    if (hasInput) {
      return this.executeInteractiveCell(cellId, code);
    }
    
    return new Promise((resolve) => {
      let output = "";
      let error = "";

      // Write code to temporary file
      const tempFile = join(this.workingDir, `cell_${cellId}.py`);
      writeFileSync(tempFile, code);

      // Execute Python
      const pythonProcess = spawn("python", ["-u", tempFile], {
        cwd: this.workingDir,
        env: { ...process.env, PATH: `${process.env.PATH}:/nix/store/*/bin` },
      });

      this.activeProcesses.set(cellId, pythonProcess);

      pythonProcess.stdout.on("data", (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        error += data.toString();
      });

      pythonProcess.on("close", (code) => {
        this.activeProcesses.delete(cellId);
        const executionTime = Date.now() - startTime;
        
        resolve({
          output,
          error,
          success: code === 0,
          executionTime,
        });
      });

      pythonProcess.on("error", (err) => {
        this.activeProcesses.delete(cellId);
        const executionTime = Date.now() - startTime;
        
        resolve({
          output: "",
          error: err.message,
          success: false,
          executionTime,
        });
      });
    });
  }

  private executeInteractiveCell(cellId: string, code: string): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      let output = "";
      let error = "";

      // Write code to temporary file
      const tempFile = join(this.workingDir, `cell_${cellId}.py`);
      writeFileSync(tempFile, code);

      // Execute Python interactively
      const pythonProcess = spawn("python", ["-u", "-i"], {
        cwd: this.workingDir,
        env: { ...process.env, PATH: `${process.env.PATH}:/nix/store/*/bin` },
      });

      // Store session info
      const session: ExecutionSession = {
        process: pythonProcess,
        output: "",
        error: "",
        startTime,
        isWaitingForInput: false,
        inputPrompt: "",
      };

      this.executionSessions.set(cellId, session);
      this.activeProcesses.set(cellId, pythonProcess);

      // Execute the code
      pythonProcess.stdin.write(`exec(open('${tempFile}').read())\n`);

      let buffer = "";
      pythonProcess.stdout.on("data", (data) => {
        const text = data.toString();
        buffer += text;
        output += text;
        session.output += text;

        // Check for input prompts (common patterns)
        const lines = buffer.split('\n');
        const lastLine = lines[lines.length - 1];
        
        // Detect input prompts
        if (lastLine && !lastLine.includes('>>>') && !lastLine.includes('...') && 
            (buffer.includes('>>> ') || text.endsWith(': ') || text.includes('Enter ') || 
             text.includes('input') || text.includes('?'))) {
          session.isWaitingForInput = true;
          session.inputPrompt = lastLine.trim();
          
          // Return intermediate result indicating waiting for input
          resolve({
            output,
            error,
            success: false,
            executionTime: Date.now() - startTime,
            isWaitingForInput: true,
            inputPrompt: session.inputPrompt,
          });
          return;
        }
      });

      pythonProcess.stderr.on("data", (data) => {
        const errorText = data.toString();
        error += errorText;
        session.error += errorText;
      });

      pythonProcess.on("close", (code) => {
        this.activeProcesses.delete(cellId);
        this.executionSessions.delete(cellId);
        const executionTime = Date.now() - startTime;
        
        resolve({
          output,
          error,
          success: code === 0,
          executionTime,
        });
      });

      pythonProcess.on("error", (err) => {
        this.activeProcesses.delete(cellId);
        this.executionSessions.delete(cellId);
        const executionTime = Date.now() - startTime;
        
        resolve({
          output: "",
          error: err.message,
          success: false,
          executionTime,
        });
      });

      // Set a timeout to resolve if nothing happens
      setTimeout(() => {
        if (this.executionSessions.has(cellId)) {
          pythonProcess.kill();
          this.activeProcesses.delete(cellId);
          this.executionSessions.delete(cellId);
          
          resolve({
            output,
            error,
            success: true,
            executionTime: Date.now() - startTime,
          });
        }
      }, 10000); // 10 second timeout
    });
  }

  async sendInput(cellId: string, input: string): Promise<ExecutionResult> {
    const session = this.executionSessions.get(cellId);
    if (!session || !session.isWaitingForInput || !session.process.stdin) {
      throw new Error("No active input session found or stdin not available");
    }

    return new Promise((resolve) => {
      session.isWaitingForInput = false;
      session.inputPrompt = "";
      
      // Send the input
      session.process.stdin!.write(input + '\n');

      // Continue listening for output
      const onData = (data: Buffer) => {
        const text = data.toString();
        session.output += text;
      };

      const onError = (data: Buffer) => {
        session.error += data.toString();
      };

      const onClose = (code: number) => {
        if (session.process.stdout) {
          session.process.stdout.off('data', onData);
        }
        if (session.process.stderr) {
          session.process.stderr.off('data', onError);
        }
        session.process.off('close', onClose);
        
        this.activeProcesses.delete(cellId);
        this.executionSessions.delete(cellId);
        
        resolve({
          output: session.output,
          error: session.error,
          success: code === 0,
          executionTime: Date.now() - session.startTime,
        });
      };

      if (session.process.stdout) {
        session.process.stdout.on('data', onData);
      }
      if (session.process.stderr) {
        session.process.stderr.on('data', onError);
      }
      session.process.on('close', onClose);
    });
  }

  async installRequirements(requirementsContent: string): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      let output = "";
      let error = "";

      // Write requirements to file
      const requirementsFile = join(this.workingDir, "requirements.txt");
      writeFileSync(requirementsFile, requirementsContent);

      // Install requirements
      const pipProcess = spawn("pip", ["install", "-r", "requirements.txt"], {
        cwd: this.workingDir,
        env: process.env,
      });

      pipProcess.stdout.on("data", (data) => {
        output += data.toString();
      });

      pipProcess.stderr.on("data", (data) => {
        error += data.toString();
      });

      pipProcess.on("close", (code) => {
        const executionTime = Date.now() - startTime;
        
        resolve({
          output,
          error,
          success: code === 0,
          executionTime,
        });
      });

      pipProcess.on("error", (err) => {
        const executionTime = Date.now() - startTime;
        
        resolve({
          output: "",
          error: err.message,
          success: false,
          executionTime,
        });
      });
    });
  }

  stopExecution(cellId: string): boolean {
    const process = this.activeProcesses.get(cellId);
    if (process) {
      process.kill();
      this.activeProcesses.delete(cellId);
      return true;
    }
    return false;
  }

  stopAllExecution(): void {
    this.activeProcesses.forEach((process, cellId) => {
      process.kill();
      this.activeProcesses.delete(cellId);
    });
  }

  generateNotebookPy(cells: Array<{ type: string; content: string }>): string {
    return cells
      .map((cell, index) => {
        if (cell.type === "python") {
          return `# Cell ${index + 1}\n${cell.content}\n`;
        } else {
          return `# Markdown Cell ${index + 1}\n"""\n${cell.content}\n"""\n`;
        }
      })
      .join("\n");
  }

  generateNotebookIpynb(cells: Array<{ type: string; content: string; output?: string }>): string {
    const notebook = {
      cells: cells.map((cell, index) => ({
        cell_type: cell.type === "python" ? "code" : "markdown",
        execution_count: cell.type === "python" ? index + 1 : null,
        metadata: {},
        outputs: cell.output ? [
          {
            output_type: "stream",
            name: "stdout",
            text: [cell.output]
          }
        ] : [],
        source: [cell.content]
      })),
      metadata: {
        kernelspec: {
          display_name: "Python 3",
          language: "python",
          name: "python3"
        },
        language_info: {
          name: "python",
          version: "3.8.0"
        }
      },
      nbformat: 4,
      nbformat_minor: 4
    };

    return JSON.stringify(notebook, null, 2);
  }
}

export const pythonExecutor = new PythonExecutor();
