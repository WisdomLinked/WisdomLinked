import React from "react";

interface FilePreviewModalProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ fileUrl, fileName, onClose }) => {
  const extension = fileUrl.split(".").pop()?.toLowerCase();

  const renderPreview = () => {
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension || "")) {
      return <img src={fileUrl} alt={fileName} className="max-h-[80vh] mx-auto rounded-md" />;
    }

    if (extension === "pdf") {
      return (
        <iframe
          src={fileUrl}
          title="PDF Preview"
          className="w-full h-[80vh] border rounded-md"
        ></iframe>
      );
    }

    if (["txt", "md", "json", "csv"].includes(extension || "")) {
      return (
        <iframe
          src={fileUrl}
          title="Text Preview"
          className="w-full h-[60vh] border rounded-md bg-white"
        ></iframe>
      );
    }
    console.log("Unsupported file type:",fileUrl, extension);
    return <div className="text-gray-400 text-sm">Preview not available for this file type.</div>;
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-4 max-w-3xl w-full relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-500 hover:text-red-500 text-xl"
        >
          &times;
        </button>
        <h2 className="text-lg font-semibold mb-4 break-all">{fileName}</h2>
        {renderPreview()}
      </div>
    </div>
  );
};

export default FilePreviewModal;
