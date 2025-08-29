import React, { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
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
  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        ['clean'],
      ],
    }),
    []
  );

  const formats = ['header', 'bold', 'italic', 'underline', 'list', 'bullet', 'link'];

  return (
    <div className={`rich-text-editor ${themeMode}`} style={{ height }}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        modules={modules}
        formats={formats}
        style={{ height: height - 42 }} // Account for toolbar height
      />
    </div>
  );
}
