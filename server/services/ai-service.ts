import { GoogleGenAI } from "@google/genai";

export interface AIProvider {
  name: string;
  models: string[];
  generateResponse(model: string, prompt: string, context?: any): Promise<string>;
}

export class GeminiProvider implements AIProvider {
  name = "gemini";
  models = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-pro"];
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateResponse(model: string, prompt: string, context?: any): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model,
        contents: prompt,
      });

      return response.text || "No response generated";
    } catch (error) {
      throw new Error(`Gemini API error: ${error}`);
    }
  }
}

export class OpenRouterProvider implements AIProvider {
  name = "openrouter";
  models = [
    "deepseek/deepseek-r1-0528:free",
    "deepseek/deepseek-chat-v3-0324:free",
    "tngtech/deepseek-r1t2-chimera:free",
    "deepseek/deepseek-r1:free",
    "z-ai/glm-4.5-air:free",
    "qwen/qwen3-coder:free",
    "google/gemini-2.0-flash-exp:free",
    "microsoft/mai-ds-r1:free",
    "openai/gpt-oss-20b:free",
    "mistralai/mistral-small-3.2-24b-instruct:free",
    "moonshotai/kimi-dev-72b:free",
    "qwen/qwen3-235b-a22b:free",
    "moonshotai/kimi-vl-a3b-thinking:free",
    "nvidia/llama-3.1-nemotron-ultra-253b-v1:free",
    "nousresearch/deephermes-3-llama-3-8b-preview:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "mistralai/mistral-nemo:free",
    "meta-llama/llama-3.3-8b-instruct:free",
    "meta-llama/llama-4-maverick:free",
    "meta-llama/llama-4-scout:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "agentica-org/deepcoder-14b-preview:free",
    "google/gemma-3-27b-it:free"
  ];
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateResponse(model: string, prompt: string, context?: any): Promise<string> {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.REPLIT_DOMAINS?.split(',')[0] || "http://localhost:5000",
          "X-Title": "Pynote Lite"
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 4000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || "No response generated";
    } catch (error) {
      throw new Error(`OpenRouter API error: ${error}`);
    }
  }
}

export class AIService {
  private providers: Map<string, AIProvider> = new Map();

  constructor() {
    // Initialize providers with API keys from environment
    const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;

    if (geminiKey) {
      this.providers.set("gemini", new GeminiProvider(geminiKey));
    }
    if (openRouterKey) {
      this.providers.set("openrouter", new OpenRouterProvider(openRouterKey));
    }
  }

  getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async generateResponse(provider: string, model: string, prompt: string, context?: any): Promise<string> {
    const aiProvider = this.providers.get(provider);
    if (!aiProvider) {
      throw new Error(`Provider ${provider} not available`);
    }

    return aiProvider.generateResponse(model, prompt, context);
  }

  buildContextPrompt(mode: string, cells: any[], userMessage: string): string {
    const cellsContext = cells.map((cell, index) => 
      `Cell ${index + 1} (${cell.type}):\n${cell.content}\n${cell.output ? `Output: ${cell.output}\n` : ''}`
    ).join('\n---\n');

    if (mode === "ask") {
      return `You are a helpful AI assistant for a Python notebook environment. Here are the current notebook cells:

${cellsContext}

User question: ${userMessage}

Please provide a helpful response based on the notebook content.`;
    } else {
      return `You are an autonomous AI agent for a Python notebook environment. You have FULL CONTROL over the notebook and can perform ANY action the user can do. Here are the current notebook cells:

${cellsContext}

User request: ${userMessage}

You can perform these actions by responding with a JSON object containing an "actions" array:

AVAILABLE ACTIONS:
1. create_cell: {"type": "create_cell", "data": {"type": "python|markdown", "content": "code", "order": 0}}
2. update_cell: {"type": "update_cell", "data": {"cellId": "id", "content": "new code"}}
3. delete_cell: {"type": "delete_cell", "data": {"cellId": "id"}}
4. execute_cell: {"type": "execute_cell", "data": {"cellId": "id", "content": "code"}}
5. install_package: {"type": "install_package", "data": {"package": "numpy"}}
6. update_requirements: {"type": "update_requirements", "data": {"content": "pandas\\nnumpy"}}
7. create_file: {"type": "create_file", "data": {"name": "test.py", "type": "py", "content": "code"}}
8. run_all_cells: {"type": "run_all_cells", "data": {}}
9. fix_error: {"type": "fix_error", "data": {"cellId": "id", "error": "error text", "originalCode": "code"}}

CRITICAL REQUIREMENTS:
- ALWAYS respond with VALID JSON only - no markdown, no backticks, no extra text
- The entire response must be a single JSON object
- Do not use code blocks or any markdown formatting  
- Execute actions to solve the problem completely

Response format (JSON only):
{
  "message": "Brief description of what I am doing",
  "actions": [
    {"type": "install_package", "data": {"package": "matplotlib"}},
    {"type": "create_cell", "data": {"type": "python", "content": "import matplotlib.pyplot as plt", "order": 0}},
    {"type": "execute_cell", "data": {"cellId": "cell-id", "content": "print('Done')"}}
  ]
}

Response must start with { and end with }.`;
    }
  }
}

export const aiService = new AIService();
