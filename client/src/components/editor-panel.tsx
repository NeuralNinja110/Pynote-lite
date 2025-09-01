import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CodeEditor } from "./code-editor";
import { NotebookCell } from "./notebook-cell";
import { File, NotebookCell as CellType } from "@shared/schema";
import { isImageFile, isPythonFile, isTextFile, getFileIcon } from "@/lib/file-utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileText, Image, X } from "lucide-react";

interface EditorPanelProps {
  file: File | null;
  onCloseFile: () => void;
}

export function EditorPanel({ file, onCloseFile }: EditorPanelProps) {
  const [fileContent, setFileContent] = useState("");
  const [executingCells, setExecutingCells] = useState<Set<string>>(new Set());
  const [inputWaitingCells, setInputWaitingCells] = useState<Map<string, string>>(new Map());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for notebook cells if file is Python
  const { data: cells = [], isLoading: cellsLoading } = useQuery<CellType[]>({
    queryKey: ["/api/files", file?.id, "cells"],
    enabled: !!file && isPythonFile(file.type),
  });

  useEffect(() => {
    if (file) {
      setFileContent(file.content || "");
    }
  }, [file]);

  const updateFileMutation = useMutation({
    mutationFn: async ({ fileId, content }: { fileId: string; content: string }) => {
      const response = await apiRequest("PUT", `/api/files/${fileId}`, { content });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({
        title: "File saved",
        description: "Your changes have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save file.",
        variant: "destructive",
      });
    },
  });

  const createCellMutation = useMutation({
    mutationFn: async ({ fileId, type, order }: { fileId: string; type: string; order: number }) => {
      const response = await apiRequest("POST", `/api/files/${fileId}/cells`, {
        type,
        content: type === 'python' ? '# Add your Python code here' : '# Add your markdown here',
        order,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files", file?.id, "cells"] });
    },
  });

  const updateCellMutation = useMutation({
    mutationFn: async ({ cellId, content }: { cellId: string; content: string }) => {
      const response = await apiRequest("PUT", `/api/cells/${cellId}`, { content });
      return response.json();
    },
  });

  const executeCellMutation = useMutation({
    mutationFn: async ({ cellId, content }: { cellId: string; content: string }) => {
      const response = await apiRequest("POST", `/api/cells/${cellId}/execute`, { content });
      return response.json();
    },
    onSuccess: (result, variables) => {
      setExecutingCells(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.cellId);
        return newSet;
      });

      if (result.isWaitingForInput) {
        setInputWaitingCells(prev => new Map(prev).set(variables.cellId, result.inputPrompt || ""));
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/files", file?.id, "cells"] });
        
        if (!result.success) {
          toast({
            title: "Execution Error",
            description: result.error || "Cell execution failed",
            variant: "destructive",
          });
        }
      }
    },
    onError: (error, variables) => {
      setExecutingCells(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.cellId);
        return newSet;
      });
      toast({
        title: "Execution Error",
        description: "Failed to execute cell",
        variant: "destructive",
      });
    },
  });

  const sendInputMutation = useMutation({
    mutationFn: async ({ cellId, input }: { cellId: string; input: string }) => {
      const response = await apiRequest("POST", `/api/cells/${cellId}/input`, { input });
      return response.json();
    },
    onSuccess: (result, variables) => {
      setInputWaitingCells(prev => {
        const newMap = new Map(prev);
        newMap.delete(variables.cellId);
        return newMap;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/files", file?.id, "cells"] });
      
      if (!result.success) {
        toast({
          title: "Input Error",
          description: result.error || "Failed to send input",
          variant: "destructive",
        });
      }
    },
    onError: (error, variables) => {
      setInputWaitingCells(prev => {
        const newMap = new Map(prev);
        newMap.delete(variables.cellId);
        return newMap;
      });
      toast({
        title: "Input Error",
        description: "Failed to send input",
        variant: "destructive",
      });
    },
  });

  const deleteCellMutation = useMutation({
    mutationFn: async (cellId: string) => {
      const response = await apiRequest("DELETE", `/api/cells/${cellId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files", file?.id, "cells"] });
    },
  });

  const handleFileContentChange = (content: string) => {
    setFileContent(content);
    if (file) {
      updateFileMutation.mutate({ fileId: file.id, content });
    }
  };

  const handleCellUpdate = (cellId: string, content: string) => {
    updateCellMutation.mutate({ cellId, content });
  };

  const handleCellExecute = (cellId: string, content: string) => {
    setExecutingCells(prev => new Set(prev).add(cellId));
    executeCellMutation.mutate({ cellId, content });
  };

  const handleSendInput = (cellId: string, input: string) => {
    sendInputMutation.mutate({ cellId, input });
  };

  const handleCellDelete = (cellId: string) => {
    deleteCellMutation.mutate(cellId);
  };

  const handleAddCell = (afterCellId: string, type: 'python' | 'markdown') => {
    if (!file) return;
    
    const afterCell = cells.find(c => c.id === afterCellId);
    const newOrder = afterCell ? afterCell.order + 1 : cells.length;
    
    createCellMutation.mutate({
      fileId: file.id,
      type,
      order: newOrder,
    });
  };

  if (!file) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground">
        <FileText className="h-16 w-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">No file selected</p>
        <p className="text-sm">Select a file from the workspace to start editing</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Editor Tab Bar */}
      <div className="bg-card border-b border-border px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 px-3 py-1 bg-primary/10 text-primary rounded">
            <i className={getFileIcon(file.type)} />
            <span className="text-sm font-medium" data-testid="active-file-name">
              {file.name}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCloseFile}
              className="h-4 w-4 p-0 hover:text-destructive"
              data-testid="button-close-file"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isPythonFile(file.type) && (
          <div className="space-y-4">
            {cellsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="p-4">
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-muted rounded w-1/4"></div>
                      <div className="h-32 bg-muted rounded"></div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : cells.length > 0 ? (
              cells.map((cell, index) => (
                <NotebookCell
                  key={cell.id}
                  cell={cell}
                  index={index}
                  onUpdate={handleCellUpdate}
                  onExecute={handleCellExecute}
                  onDelete={handleCellDelete}
                  onAddCell={handleAddCell}
                  onSendInput={handleSendInput}
                  isExecuting={executingCells.has(cell.id)}
                  isWaitingForInput={inputWaitingCells.has(cell.id)}
                  inputPrompt={inputWaitingCells.get(cell.id)}
                />
              ))
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-4">No cells in this notebook</p>
                <div className="flex justify-center space-x-2">
                  <Button
                    onClick={() => handleAddCell("", 'python')}
                    data-testid="button-add-first-python-cell"
                  >
                    Add Python Cell
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleAddCell("", 'markdown')}
                    data-testid="button-add-first-markdown-cell"
                  >
                    Add Markdown Cell
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}

        {isTextFile(file.type) && (
          <Card className="p-4">
            <CodeEditor
              value={fileContent}
              language="plaintext"
              onChange={handleFileContentChange}
              className="min-h-96"
            />
          </Card>
        )}

        {isImageFile(file.type) && (
          <Card className="p-4">
            <div className="text-center">
              {file.base64Data ? (
                <img 
                  src={`data:image/${file.type};base64,${file.base64Data}`}
                  alt={file.name}
                  className="max-w-full max-h-96 mx-auto rounded shadow-lg"
                  data-testid={`image-viewer-${file.id}`}
                />
              ) : (
                <div>
                  <Image className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No image data available</p>
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                {file.name}
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
