import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";

// Configure Monaco environment to disable workers
if (typeof window !== 'undefined') {
  (window as any).MonacoEnvironment = {
    getWorker: () => {
      return new Worker(
        URL.createObjectURL(
          new Blob([''], { type: 'application/javascript' })
        )
      );
    },
  };
}

interface CodeEditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  className?: string;
}

export function CodeEditor({ value, language, onChange, readOnly = false, className = "" }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (editorRef.current) {
      // Configure Monaco for Python
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
      });

      const editor = monaco.editor.create(editorRef.current, {
        value,
        language,
        theme: 'vs-light',
        readOnly,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 14,
        fontFamily: 'JetBrains Mono, Fira Code, Monaco, Consolas, monospace',
        lineNumbers: 'on',
        wordWrap: 'on',
        automaticLayout: true,
      });

      monacoRef.current = editor;

      editor.onDidChangeModelContent(() => {
        if (!readOnly) {
          onChange(editor.getValue());
        }
      });

      return () => {
        editor.dispose();
      };
    }
  }, [language, readOnly]);

  useEffect(() => {
    if (monacoRef.current && value !== monacoRef.current.getValue()) {
      monacoRef.current.setValue(value);
    }
  }, [value]);

  return <div ref={editorRef} className={`${className}`} style={{ height: '200px' }} />;
}
