"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileAttachment } from "@/lib/storage";
import { Upload, X, File, Check } from "lucide-react";

interface ResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (resolutionText: string, attachments: FileAttachment[]) => void;
  ticketId: string;
  departmentName: string;
  isFinalStep?: boolean;
  loading?: boolean;
}

export function ResolutionModal({ isOpen, onClose, onSubmit, ticketId, departmentName, isFinalStep = false, loading = false }: ResolutionModalProps) {
  const [resolutionText, setResolutionText] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = e.target?.result as string;
        const attachment: FileAttachment = {
          id: `file_${Date.now()}_${Math.random()}`,
          name: file.name,
          size: file.size,
          type: file.type,
          data: base64Data,
          uploadedAt: new Date(),
        };
        setAttachments((prev) => [...prev, attachment]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== attachmentId));
  };

  const handleSubmit = () => {
    if (!resolutionText.trim()) return;
    onSubmit(resolutionText.trim(), attachments);
  };

  const handleClose = () => {
    setResolutionText("");
    setAttachments([]);
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            {isFinalStep ? "Final Resolution" : "Resolve for Department"}
          </DialogTitle>
          <DialogDescription>{isFinalStep ? `Mark ticket ${ticketId} as fully resolved. This will close the ticket permanently.` : `Resolve ticket ${ticketId} for ${departmentName}. The ticket will move to the next department in the workflow.`}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resolution Details */}
          <div className="space-y-3">
            <Label htmlFor="resolutionText" className="text-sm font-medium">
              Resolution Details <span className="text-red-500">*</span>
            </Label>
            <Textarea id="resolutionText" value={resolutionText} onChange={(e) => setResolutionText(e.target.value)} placeholder="Describe how this ticket was resolved, what actions were taken, and any important notes..." rows={4} className="resize-none" />
            <p className="text-xs text-gray-500">Provide detailed information about the resolution. This will be visible to other departments and for future reference.</p>
          </div>

          {/* File Attachments */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">File Attachments (Optional)</Label>

            {/* File Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFileSelect(e.dataTransfer.files);
              }}
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-2">
                Drag and drop files here, or{" "}
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-blue-600 hover:text-blue-800 underline">
                  browse
                </button>
              </p>
              <p className="text-xs text-gray-500">Supported formats: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF (Max 10MB per file)</p>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif" onChange={(e) => handleFileSelect(e.target.files)} className="hidden" />
            </div>

            {/* Attached Files */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Attached Files:</p>
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center gap-3">
                        <File className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{attachment.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(attachment.size)}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeAttachment(attachment.id)} className="text-red-500 hover:text-red-700 p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!resolutionText.trim() || loading} className="bg-green-600 hover:bg-green-700">
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {isFinalStep ? "Resolving..." : "Resolving for Department..."}
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                {isFinalStep ? "Mark as Fully Resolved" : "Resolve for Department"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
