import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Upload, FileText, Image, Code } from "lucide-react";
import { File } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { getFileIcon, getFileIconColor } from "@/lib/file-utils";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface WorkspacePanelProps {
  onFileSelect: (file: File) => void;
  selectedFileId?: string;
}

export function WorkspacePanel({ onFileSelect, selectedFileId }: WorkspacePanelProps) {
  const [newFileName, setNewFileName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: files = [], isLoading } = useQuery<File[]>({
    queryKey: ["/api/files"],
  });

  const createFileMutation = useMutation({
    mutationFn: async (fileData: { name: string; type: string; content: string }) => {
      const response = await apiRequest("POST", "/api/files", fileData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      setCreateDialogOpen(false);
      setNewFileName("");
      toast({
        title: "File created",
        description: "Your file has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create file.",
        variant: "destructive",
      });
    },
  });

  const handleCreateFile = () => {
    if (!newFileName.trim()) return;
    
    const extension = newFileName.split('.').pop()?.toLowerCase() || 'txt';
    const type = ['py', 'txt', 'png', 'jpg', 'jpeg', 'webp'].includes(extension) ? extension : 'txt';
    
    let content = "";
    if (type === 'py') {
      content = "# Marimo notebook cell\nimport marimo as mo\n";
    } else if (type === 'txt') {
      content = "";
    }

    createFileMutation.mutate({
      name: newFileName,
      type,
      content,
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase() || 'txt';
    const type = ['py', 'txt', 'png', 'jpg', 'jpeg', 'webp'].includes(extension) ? extension : 'txt';

    if (['png', 'jpg', 'jpeg', 'webp'].includes(type)) {
      // Handle image files
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = (reader.result as string).split(',')[1];
        createFileMutation.mutate({
          name: file.name,
          type,
          content: "",
          base64Data,
        });
      };
      reader.readAsDataURL(file);
    } else {
      // Handle text files
      const reader = new FileReader();
      reader.onload = () => {
        createFileMutation.mutate({
          name: file.name,
          type,
          content: reader.result as string,
        });
      };
      reader.readAsText(file);
    }

    setUploadDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="w-64 bg-card border-r border-border p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-8 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Workspace
        </h3>
      </div>

      {/* File Actions */}
      <div className="p-3 border-b border-border">
        <div className="flex space-x-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex-1" data-testid="button-create-file">
                <Plus className="h-3 w-3 mr-1" />
                Create
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New File</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="filename.py or filename.txt"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateFile()}
                  data-testid="input-filename"
                />
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateFile}
                    disabled={!newFileName.trim() || createFileMutation.isPending}
                    data-testid="button-confirm-create"
                  >
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary" className="flex-1" data-testid="button-upload-file">
                <Upload className="h-3 w-3 mr-1" />
                Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload File</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  type="file"
                  accept=".py,.txt,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileUpload}
                  data-testid="input-file-upload"
                />
                <p className="text-sm text-muted-foreground">
                  Supported formats: .py, .txt, .png, .jpg, .jpeg, .webp
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
        {files.map((file) => (
          <div
            key={file.id}
            className={cn(
              "p-2 cursor-pointer flex items-center space-x-2 hover:bg-muted transition-colors",
              selectedFileId === file.id && "bg-accent text-accent-foreground"
            )}
            onClick={() => onFileSelect(file)}
            data-testid={`file-item-${file.id}`}
          >
            <i className={cn(getFileIcon(file.type), getFileIconColor(file.type), "text-sm")} />
            <span className="text-sm truncate" title={file.name}>
              {file.name}
            </span>
          </div>
        ))}
        
        {files.length === 0 && (
          <div className="p-4 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No files yet</p>
            <p className="text-xs">Create or upload a file to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
