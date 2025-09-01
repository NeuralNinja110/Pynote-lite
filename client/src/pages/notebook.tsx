import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { WorkspacePanel } from "@/components/workspace-panel";
import { EditorPanel } from "@/components/editor-panel";
import { CopilotPanel } from "@/components/copilot-panel";
import { useTheme } from "@/components/theme-provider";
import { File, NotebookCell } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { downloadFile } from "@/lib/file-utils";
import { useToast } from "@/hooks/use-toast";
import { Play, Square, Download, StickyNote, Sun, Moon } from "lucide-react";

export default function NotebookPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { theme, toggleTheme, setThemeColor } = useTheme();
  const { toast } = useToast();

  // Query for notebook cells if file is selected
  const { data: cells = [] } = useQuery<NotebookCell[]>({
    queryKey: ["/api/files", selectedFile?.id, "cells"],
    enabled: !!selectedFile && selectedFile.type === 'py',
  });

  const stopExecutionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/execution/stop");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Execution stopped",
        description: "All running cells have been stopped.",
      });
    },
  });

  const runAllCellsMutation = useMutation({
    mutationFn: async (cells: NotebookCell[]) => {
      const results = [];
      for (const cell of cells) {
        if (cell.type === 'python') {
          const response = await apiRequest("POST", `/api/cells/${cell.id}/execute`, {
            content: cell.content,
          });
          results.push(await response.json());
        }
      }
      return results;
    },
    onSuccess: () => {
      toast({
        title: "Execution complete",
        description: "All cells have been executed.",
      });
    },
    onError: () => {
      toast({
        title: "Execution error",
        description: "Some cells failed to execute.",
        variant: "destructive",
      });
    },
  });

  const handleDownloadPy = async () => {
    if (!selectedFile) return;
    
    try {
      const response = await fetch(`/api/files/${selectedFile.id}/download/py`);
      const content = await response.text();
      downloadFile(content, `${selectedFile.name.replace('.py', '')}.py`, 'text/plain');
    } catch (error) {
      toast({
        title: "Download error",
        description: "Failed to download Python file.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadIpynb = async () => {
    if (!selectedFile) return;
    
    try {
      const response = await fetch(`/api/files/${selectedFile.id}/download/ipynb`);
      const content = await response.text();
      downloadFile(content, `${selectedFile.name.replace('.py', '')}.ipynb`, 'application/json');
    } catch (error) {
      toast({
        title: "Download error",
        description: "Failed to download Jupyter notebook.",
        variant: "destructive",
      });
    }
  };

  const themeColors = [
    { name: 'black', class: 'bg-black' },
    { name: 'pink', class: 'bg-pink-500' },
    { name: 'red', class: 'bg-red-500' },
    { name: 'green', class: 'bg-green-500' },
    { name: 'purple', class: 'bg-purple-500' },
    { name: 'blue', class: 'bg-blue-500' },
    { name: 'yellow', class: 'bg-yellow-500' },
  ];

  return (
    <div className="h-screen flex flex-col">
      {/* Top Bar */}
      <header className="bg-card border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <StickyNote className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Pynote Lite</h1>
          </div>

          {/* Notebook Controls */}
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => runAllCellsMutation.mutate(cells)}
              disabled={!selectedFile || cells.length === 0 || runAllCellsMutation.isPending}
              data-testid="button-run-all"
            >
              <Play className="h-4 w-4 mr-1" />
              Run All
            </Button>
            <Button
              variant="destructive"
              onClick={() => stopExecutionMutation.mutate()}
              disabled={stopExecutionMutation.isPending}
              data-testid="button-stop-execution"
            >
              <Square className="h-4 w-4 mr-1" />
              Stop
            </Button>
            <div className="h-6 w-px bg-border" />
            <Button
              variant="secondary"
              onClick={handleDownloadPy}
              disabled={!selectedFile || selectedFile.type !== 'py'}
              data-testid="button-download-py"
            >
              <Download className="h-4 w-4 mr-1" />
              .py
            </Button>
            <Button
              variant="secondary"
              onClick={handleDownloadIpynb}
              disabled={!selectedFile || selectedFile.type !== 'py'}
              data-testid="button-download-ipynb"
            >
              <Download className="h-4 w-4 mr-1" />
              .ipynb
            </Button>
          </div>
        </div>

        {/* Theme Controls */}
        <div className="flex items-center space-x-3">
          {/* Theme Color Selector */}
          <div className="flex items-center space-x-1">
            {themeColors.map(color => (
              <button
                key={color.name}
                className={`w-4 h-4 rounded-full ${color.class} cursor-pointer hover:scale-110 transition-transform ${
                  theme.color === color.name ? 'ring-2 ring-ring ring-offset-2' : ''
                }`}
                onClick={() => setThemeColor(color.name as any)}
                data-testid={`theme-color-${color.name}`}
              />
            ))}
          </div>

          {/* Dark/Light Mode Toggle */}
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleTheme}
            data-testid="button-toggle-theme"
          >
            {theme.mode === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Workspace Panel */}
          <ResizablePanel defaultSize={20} minSize={15}>
            <WorkspacePanel
              onFileSelect={setSelectedFile}
              selectedFileId={selectedFile?.id}
            />
          </ResizablePanel>
          
          <ResizableHandle />
          
          {/* Editor Panel */}
          <ResizablePanel defaultSize={60} minSize={30}>
            <EditorPanel
              file={selectedFile}
              onCloseFile={() => setSelectedFile(null)}
            />
          </ResizablePanel>
          
          <ResizableHandle />
          
          {/* Copilot Panel */}
          <ResizablePanel defaultSize={20} minSize={15}>
            <CopilotPanel
              currentFileId={selectedFile?.id}
              cells={cells}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
