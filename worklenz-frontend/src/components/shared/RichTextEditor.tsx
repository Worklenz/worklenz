import React, { useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { Editor as TinyMCEEditor } from 'tinymce';
import './RichTextEditor.css';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  themeMode?: 'light' | 'dark';
  height?: number;
  readOnly?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Enter text...',
  themeMode = 'light',
  height = 200,
  readOnly = false,
}: RichTextEditorProps) {
  const editorRef = useRef<TinyMCEEditor | null>(null);

  return (
    <div className={`rich-text-editor ${themeMode}`} style={{ height }}>
      <Editor
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        onInit={(_evt, editor) => (editorRef.current = editor)}
        value={value}
        onEditorChange={onChange}
        disabled={readOnly}
        init={{
          height: height,
          menubar: false,
          skin: themeMode === 'dark' ? 'oxide-dark' : 'oxide',
          content_css: themeMode === 'dark' ? 'dark' : 'default',
          placeholder: placeholder,
          plugins: ['lists', 'link', 'autolink'],
          toolbar: 'blocks | bold italic underline | bullist numlist | link | removeformat',
          content_style: `
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              font-size: 14px;
              line-height: 1.5;
            }
          `,
          branding: false,
          promotion: false,
          statusbar: false,
        }}
      />
    </div>
  );
}
