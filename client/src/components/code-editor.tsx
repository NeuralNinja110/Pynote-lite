import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { python } from "@codemirror/lang-python";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { autocompletion } from "@codemirror/autocomplete";

interface CodeEditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  className?: string;
}

export function CodeEditor({ value, language, onChange, readOnly = false, className = "" }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (editorRef.current && !viewRef.current) {
      // Determine language extension
      const languageExtension = language === 'python' ? python() : markdown();
      
      // Create editor state
      const state = EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          languageExtension,
          autocompletion(),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !readOnly) {
              onChange(update.state.doc.toString());
            }
          }),
          EditorState.readOnly.of(readOnly),
          EditorView.theme({
            '&': {
              fontSize: '14px',
              fontFamily: 'JetBrains Mono, Fira Code, Monaco, Consolas, monospace',
            },
            '.cm-editor': {
              border: '1px solid #e1e5e9',
              borderRadius: '6px',
            },
            '.cm-focused': {
              outline: 'none',
              borderColor: '#0969da',
            },
            '.cm-scroller': {
              padding: '8px',
            },
            '.cm-content': {
              minHeight: '120px',
            }
          })
        ]
      });

      // Create editor view
      const view = new EditorView({
        state,
        parent: editorRef.current,
      });

      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }
  }, [language, readOnly]);

  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return <div ref={editorRef} className={className} />;
}
