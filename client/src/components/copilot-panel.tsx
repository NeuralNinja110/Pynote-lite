import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Bot, Settings, Send, ChevronDown, Info } from "lucide-react";
import { ChatMessage, CopilotSession, NotebookCell } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CopilotPanelProps {
  currentFileId?: string;
  cells?: NotebookCell[];
}

interface AIProvider {
  name: string;
  models: string[];
}

export function CopilotPanel({ currentFileId, cells = [] }: CopilotPanelProps) {
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState<string>("");
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [mode, setMode] = useState<'ask' | 'agent'>('ask');
  const [usageMode, setUsageMode] = useState<'free' | 'restrictive'>('free');
  const [provider, setProvider] = useState<string>('gemini');
  const [model, setModel] = useState<string>('gemini-2.5-flash');
  const [apiKey, setApiKey] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for available providers
  const { data: providers = [] } = useQuery<AIProvider[]>({
    queryKey: ["/api/ai/providers"],
  });

  // Query for chat messages
  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/copilot/sessions", sessionId, "messages"],
    enabled: !!sessionId,
  });

  const createSessionMutation = useMutation({
    mutationFn: async (sessionData: {
      provider: string;
      model: string;
      mode: string;
      usageMode: string;
    }) => {
      const response = await apiRequest("POST", "/api/copilot/sessions", sessionData);
      return response.json();
    },
    onSuccess: (session: CopilotSession) => {
      setSessionId(session.id);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ sessionId, message, cells, apiKey }: {
      sessionId: string;
      message: string;
      cells: NotebookCell[];
      apiKey?: string;
    }) => {
      const response = await apiRequest("POST", `/api/copilot/sessions/${sessionId}/chat`, {
        message,
        cells,
        fileId: currentFileId,
        apiKey,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/copilot/sessions", sessionId, "messages"] });
      // If agent mode performed actions, refresh the cells and files
      if (data.actionResults && data.actionResults.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/files"] });
        if (currentFileId) {
          queryClient.invalidateQueries({ queryKey: ["/api/files", currentFileId, "cells"] });
        }
      }
      setMessage("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message to copilot.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    // Initialize session when settings change
    if (provider && model) {
      createSessionMutation.mutate({
        provider,
        model,
        mode,
        usageMode,
      });
    }
  }, [provider, model, mode, usageMode]);

  const handleSendMessage = () => {
    if (!message.trim() || !sessionId) return;
    
    sendMessageMutation.mutate({
      sessionId,
      message: message.trim(),
      cells,
      apiKey: apiKey.trim() || undefined,
    });
  };

  const handleQuickAction = (action: string) => {
    const quickMessages: Record<string, string> = {
      'fix-errors': 'Please analyze the code and fix any errors you find.',
      'add-comments': 'Please add helpful comments to explain the code.',
      'optimize': 'Please optimize this code for better performance and readability.',
    };
    
    setMessage(quickMessages[action] || action);
  };

  const currentProvider = providers.find(p => p.name === provider);

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col">
      {/* Copilot Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center space-x-2">
            <Bot className="h-4 w-4 text-accent" />
            <span>Pynote Copilot</span>
          </h3>
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="ghost" data-testid="button-toggle-settings">
                <Settings className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-muted rounded-lg p-1">
          <Button
            size="sm"
            variant={mode === 'ask' ? 'default' : 'ghost'}
            className="flex-1"
            onClick={() => setMode('ask')}
            data-testid="button-ask-mode"
          >
            Ask Mode
          </Button>
          <Button
            size="sm"
            variant={mode === 'agent' ? 'default' : 'ghost'}
            className="flex-1"
            onClick={() => setMode('agent')}
            data-testid="button-agent-mode"
          >
            Agent Mode
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <CollapsibleContent>
          <div className="bg-muted/50 border-b border-border p-3 space-y-3">
            {/* Usage Mode */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Usage Mode
              </label>
              <Select value={usageMode} onValueChange={(value: 'free' | 'restrictive') => setUsageMode(value)}>
                <SelectTrigger className="w-full" data-testid="select-usage-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free (No Restrictions)</SelectItem>
                  <SelectItem value="restrictive">Restrictive (Minimize Tokens)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Provider Selection */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Provider
              </label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger className="w-full" data-testid="select-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map(p => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name === 'gemini' ? 'Gemini' : 'OpenRouter AI'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model Selection */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Model
              </label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-full" data-testid="select-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentProvider?.models.map(m => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* API Key Input */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                API Key
              </label>
              <Input
                type="password"
                placeholder="Enter API key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="text-xs"
                data-testid="input-api-key"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Or set as environment variable
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col">
        {/* Chat Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Start a conversation with your AI copilot</p>
                <p className="text-xs">
                  {mode === 'ask' 
                    ? 'Ask questions about your code' 
                    : 'Request code changes and improvements'
                  }
                </p>
              </div>
            )}
            
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`rounded-lg p-3 max-w-xs text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                  data-testid={`message-${msg.role}-${msg.id}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center space-x-2 mb-2">
                      <Bot className="h-3 w-3 text-accent" />
                      <span className="text-xs font-medium text-muted-foreground">
                        Copilot
                      </span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {cells.length > 0 && (
              <div className="flex justify-center">
                <div className="bg-accent/10 text-accent rounded px-2 py-1 text-xs flex items-center space-x-1">
                  <Info className="h-3 w-3" />
                  <span>Copilot has read {cells.length} cells and their outputs</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Chat Input */}
        <div className="p-4 border-t border-border">
          <div className="flex space-x-2">
            <Input
              placeholder={
                mode === 'ask' 
                  ? "Ask about your code..." 
                  : "Request changes or improvements..."
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1"
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || sendMessageMutation.isPending || !sessionId}
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-1 mt-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleQuickAction('fix-errors')}
              data-testid="button-quick-fix-errors"
            >
              Fix errors
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleQuickAction('add-comments')}
              data-testid="button-quick-add-comments"
            >
              Add comments
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleQuickAction('optimize')}
              data-testid="button-quick-optimize"
            >
              Optimize code
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
