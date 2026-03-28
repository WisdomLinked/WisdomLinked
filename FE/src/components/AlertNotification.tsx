import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { hideAlert } from "../actions/alertActions";
import { useAppSelector } from "../store";
import { AlertCircle } from "lucide-react";

const AUTO_HIDE_MS = 5000;

const AlertNotification: React.FC = () => {
  const dispatch = useDispatch();
  const { open, message } = useAppSelector((state) => state.alert);

  const handleClose = () => {
    dispatch(hideAlert());
  };

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      handleClose();
    }, AUTO_HIDE_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open || !message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[10000001] flex justify-center px-4 pb-6">
      <div className="pointer-events-auto inline-flex max-w-md items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-lg shadow-black/10">
        <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#e8f0f8]">
          <AlertCircle className="h-4 w-4 text-[#234C6A]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-gray-900 break-words">{message}</p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default AlertNotification;
