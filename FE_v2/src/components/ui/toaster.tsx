import { useEffect, useState } from "react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export interface ToastMessage {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 5000;

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string, onRemove: () => void) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    onRemove();
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    window.toast = (message: Omit<ToastMessage, "id">) => {
      const id = genId();
      const toast: ToastMessage = { id, ...message };
      
      setToasts((prev) => {
        const newToasts = [toast, ...prev];
        return newToasts.slice(0, TOAST_LIMIT);
      });

      addToRemoveQueue(id, () => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      });
    };
  }, []);

  return (
    <ToastProvider>
      {toasts.map((toast) => (
        <Toast key={toast.id} variant={toast.variant}>
          <div className="grid gap-1">
            {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
            {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

// Type declaration for global toast
declare global {
  interface Window {
    toast: (message: Omit<ToastMessage, "id">) => void;
  }
}

