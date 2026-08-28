import React, { useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
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
      toolbar: readOnly
        ? false
        : [
            [{ header: [2, 3, false] }],
            ['bold', 'italic', 'underline'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link'],
            ['clean'],
          ],
      clipboard: {
        matchVisual: false,
      },
    }),
    [readOnly]
  );

  // 'bullet' is not a registered format in Quill 2 — 'list' covers both the
  // ordered and bulleted variants. Leaving it in makes Quill log an error for
  // an unknown format on init.
  const formats = useMemo(() => ['header', 'bold', 'italic', 'underline', 'list', 'link'], []);

  return (
    <div className={`rich-text-editor ${themeMode}`} style={{ minHeight: height }}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
      />
    </div>
  );
}
