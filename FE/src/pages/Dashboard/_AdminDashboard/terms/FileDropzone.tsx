import React, { useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { DOCX_MIME, FOCUS, MAX_DOCX_BYTES, formatBytes } from './termsModel';

export default function FileDropzone({
  file,
  error,
  onSelect,
  onError,
  onClear,
}: {
  file: File | null;
  error: string;
  onSelect: (next: File) => void;
  onError: (message: string) => void;
  onClear: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputId = 'terms-docx-upload';
  const inputRef = useRef<HTMLInputElement>(null);

  const applyFile = (next: File | undefined) => {
    if (!next) return;
    const isDocx = next.name.toLowerCase().endsWith('.docx') || next.type === DOCX_MIME;
    if (!isDocx) {
      onClear();
      onError('Only .docx files are accepted.');
      return;
    }
    if (next.size > MAX_DOCX_BYTES) {
      onClear();
      onError('File must be 10 MB or smaller.');
      return;
    }
    onSelect(next);
  };

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-slate-700">
        Agreement document
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        onChange={event => {
          applyFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
              <p className="text-sm text-slate-500">{formatBytes(file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClear}
            className={`${FOCUS} inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-900`}
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload agreement document"
          onClick={() => inputRef.current?.click()}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={event => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={event => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={event => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={event => {
            event.preventDefault();
            setDragging(false);
            applyFile(event.dataTransfer.files?.[0]);
          }}
          className={`${FOCUS} cursor-pointer rounded-xl border border-dashed px-4 py-8 text-center ${
            dragging ? 'border-slate-900 bg-slate-50' : 'border-slate-300 bg-white'
          }`}
        >
          <Upload className="mx-auto h-6 w-6 text-slate-400" aria-hidden />
          <p className="mt-2 text-sm text-slate-700">
            Drag and drop a .docx file, or <span className="font-medium text-slate-900 underline">browse</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">DOCX only, up to 10 MB.</p>
        </div>
      )}
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
