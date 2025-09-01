import { spawn, ChildProcess } from "child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export interface ExecutionResult {
  output: string;
  error: string;
  success: boolean;
  executionTime: number;
}

export class PythonExecutor {
  private workingDir: string;
  private activeProcesses: Map<string, ChildProcess> = new Map();

  constructor() {
    this.workingDir = join(process.cwd(), "python_workspace");
    if (!existsSync(this.workingDir)) {
      mkdirSync(this.workingDir, { recursive: true });
    }
  }

  async executeCell(cellId: string, code: string): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      let output = "";
      let error = "";

      // Write code to temporary file
      const tempFile = join(this.workingDir, `cell_${cellId}.py`);
      writeFileSync(tempFile, code);

      // Execute Python
      const pythonProcess = spawn("python", [tempFile], {
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
