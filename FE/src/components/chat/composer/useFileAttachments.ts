import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { formatChatFileBytes, isAllowedChatFileName } from '../../../utils/chatAttachments';

export type AttachmentItem = {
  id: string;
  file: File;
  previewUrl?: string;
};

export function isImageFile(file: File): boolean {
  return /^image\/(jpeg|jpg|png|webp)$/i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

let nextId = 0;

export function useFileAttachments({ maxFileSizeMB, maxFiles }: { maxFileSizeMB: number; maxFiles: number }) {
  const [items, setItems] = useState<AttachmentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(
    () => () => {
      itemsRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    },
    [],
  );

  const addFiles = useCallback(
    (incoming: FileList | File[] | null | undefined) => {
      const files = Array.from(incoming || []);
      if (!files.length) return;
      const maxBytes = maxFileSizeMB * 1024 * 1024;
      const rejected: string[] = [];
      const accepted: AttachmentItem[] = [];
      let room = maxFiles - itemsRef.current.length;

      for (const file of files) {
        if (!isAllowedChatFileName(file.name)) {
          rejected.push(`${file.name}: file type not supported`);
        } else if (file.size > maxBytes) {
          rejected.push(`${file.name}: ${formatChatFileBytes(file.size)} is over the ${maxFileSizeMB} MB limit`);
        } else if (room <= 0) {
          rejected.push(`${file.name}: only ${maxFiles} files per message`);
        } else {
          room -= 1;
          accepted.push({
            id: `att-${(nextId += 1)}`,
            file,
            previewUrl: isImageFile(file) ? URL.createObjectURL(file) : undefined,
          });
        }
      }

      if (accepted.length) setItems((prev) => [...prev, ...accepted]);
      setError(rejected.length ? rejected.join(' · ') : null);
    },
    [maxFileSizeMB, maxFiles],
  );

  const removeFile = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
    setError(null);
  }, []);

  const clearFiles = useCallback(() => {
    setItems((prev) => {
      prev.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    setError(null);
  }, []);

  const dragHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      setDragOver(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      setDragOver(false);
    },
    onDrop: (e: React.DragEvent) => {
      setDragOver(false);
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      addFiles(e.dataTransfer.files);
    },
  };

  return { items, error, dragOver, addFiles, removeFile, clearFiles, dragHandlers };
}
