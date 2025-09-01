import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "./code-editor";
import { Play, Trash2, Hash, Plus } from "lucide-react";
import { NotebookCell as CellType } from "@shared/schema";
import { cn } from "@/lib/utils";

interface NotebookCellProps {
  cell: CellType;
  index: number;
  onUpdate: (cellId: string, content: string) => void;
  onExecute: (cellId: string, content: string) => void;
  onDelete: (cellId: string) => void;
  onAddCell: (afterCellId: string, type: 'python' | 'markdown') => void;
  isExecuting?: boolean;
}

export function NotebookCell({ 
  cell, 
  index, 
  onUpdate, 
  onExecute, 
  onDelete, 
  onAddCell,
  isExecuting = false 
}: NotebookCellProps) {
  const [content, setContent] = useState(cell.content);
  const [isEditing, setIsEditing] = useState(false);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    onUpdate(cell.id, newContent);
  };

  const handleExecute = () => {
    onExecute(cell.id, content);
  };

  const renderMarkdownOutput = (markdown: string) => {
    // Simple markdown rendering - could be enhanced with a proper library
    return (
      <div 
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ 
          __html: markdown
            .replace(/^# (.*$)/gm, '<h1 class="text-xl font-bold mb-4">$1</h1>')
            .replace(/^## (.*$)/gm, '<h2 class="text-lg font-semibold mb-3">$1</h2>')
            .replace(/^\* (.*$)/gm, '<li>$1</li>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
        }}
      />
    );
  };

  return (
    <Card className={cn(
      "mb-4 p-4 border-2 transition-all duration-200",
      isEditing ? "border-primary" : "border-border hover:border-muted-foreground/30"
    )}>
      {/* Cell Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-medium text-muted-foreground">
            {cell.type === 'python' ? 'Python' : 'Markdown'} Cell [{index + 1}]
          </span>
          {isExecuting && (
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" data-testid={`execution-indicator-${cell.id}`} />
          )}
          {cell.executed && !isExecuting && (
            <div className="w-2 h-2 bg-green-500 rounded-full" data-testid={`executed-indicator-${cell.id}`} />
          )}
        </div>
        <div className="flex items-center space-x-2">
          {cell.type === 'python' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleExecute}
              disabled={isExecuting}
              data-testid={`button-run-cell-${cell.id}`}
            >
              <Play className="h-3 w-3" />
            </Button>
          )}
          {cell.type === 'markdown' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleExecute}
              data-testid={`button-compile-markdown-${cell.id}`}
            >
              <Hash className="h-3 w-3" />
              Compile
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(cell.id)}
            className="text-destructive hover:text-destructive"
            data-testid={`button-delete-cell-${cell.id}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Cell Content */}
      <div className="space-y-3">
        {/* Code/Markdown Input */}
        <div onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)}>
          <CodeEditor
            value={content}
            language={cell.type === 'python' ? 'python' : 'markdown'}
            onChange={handleContentChange}
            className="border border-border rounded"
          />
        </div>

        {/* Output */}
        {cell.output && (
          <div className="bg-muted/50 border border-border rounded p-3">
            <div className="text-xs text-muted-foreground mb-2">
              {cell.type === 'python' ? 'Output:' : 'Rendered:'}
            </div>
            {cell.type === 'python' ? (
              <pre className="font-mono text-sm whitespace-pre-wrap" data-testid={`output-${cell.id}`}>
                {cell.output}
              </pre>
            ) : (
              <div data-testid={`rendered-${cell.id}`}>
                {renderMarkdownOutput(cell.output)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cell Action Buttons */}
      <div className="flex items-center space-x-2 mt-4 pt-3 border-t border-border">
        <Button
          size="sm"
          onClick={() => onAddCell(cell.id, 'python')}
          data-testid={`button-add-python-${cell.id}`}
        >
          <Plus className="h-3 w-3 mr-1" />
          Python Cell
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onAddCell(cell.id, 'markdown')}
          data-testid={`button-add-markdown-${cell.id}`}
        >
          <Hash className="h-3 w-3 mr-1" />
          Markdown Cell
        </Button>
      </div>
    </Card>
  );
}
