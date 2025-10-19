"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { WorkflowResolution } from "@/lib/storage";

interface RevertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (targetDepartment: string, reason: string) => void;
  ticketId: string;
  currentDepartment?: string;
  workflowResolutions: WorkflowResolution[];
  loading: boolean;
}

export function RevertModal({ isOpen, onClose, onSubmit, ticketId, currentDepartment, workflowResolutions, loading }: RevertModalProps) {
  const [targetDepartment, setTargetDepartment] = useState("");
  const [reason, setReason] = useState("");

  // Get unique departments that have processed this ticket
  const processedDepartments = [...new Set(workflowResolutions.map((r) => r.fromDepartment))];

  // Filter out current department and sort
  const availableDepartments = processedDepartments.filter((dept) => dept !== currentDepartment).sort();

  const handleSubmit = () => {
    if (targetDepartment && reason.trim()) {
      onSubmit(targetDepartment, reason.trim());
      setTargetDepartment("");
      setReason("");
    }
  };

  const handleClose = () => {
    setTargetDepartment("");
    setReason("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeft className="w-5 h-5 text-orange-500" />
            Revert Ticket {ticketId.slice(-8)}
          </DialogTitle>
          <DialogDescription>Send this ticket back to a previous department in the workflow. This action will be logged and the ticket will be reassigned.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Current Status */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm">
              <span className="font-medium text-blue-900">Current Department:</span> <span className="text-blue-700">{currentDepartment || "Not assigned"}</span>
            </div>
            <div className="text-sm mt-1">
              <span className="font-medium text-blue-900">Workflow Steps Completed:</span> <span className="text-blue-700">{workflowResolutions.length}</span>
            </div>
          </div>

          {/* Target Department Selection */}
          <div className="space-y-2">
            <Label htmlFor="targetDepartment">
              Revert to Department <span className="text-red-500">*</span>
            </Label>
            <Select value={targetDepartment} onValueChange={setTargetDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Select department to revert to..." />
              </SelectTrigger>
              <SelectContent>
                {availableDepartments.length > 0 ? (
                  availableDepartments.map((department) => (
                    <SelectItem key={department} value={department}>
                      <div className="flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4 text-orange-500" />
                        {department}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled>
                    No previous departments available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {availableDepartments.length === 0 && <p className="text-xs text-gray-500">This ticket hasn&apos;t been processed by any other departments yet.</p>}
          </div>

          {/* Reason for Revert */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason for Revert <span className="text-red-500">*</span>
            </Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why this ticket needs to be reverted to the previous department..." rows={4} className="resize-none" />
            <p className="text-xs text-gray-500">Provide a clear explanation for the revert. This will be visible to the receiving department and logged for audit purposes.</p>
          </div>

          {/* Warning */}
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-orange-800">
                <div className="font-medium">Warning:</div>
                <div className="mt-1">
                  Reverting this ticket will:
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Send it back to the selected department</li>
                    <li>Reset the workflow step to the previous stage</li>
                    <li>Log this action in the audit trail</li>
                    <li>Notify the receiving department</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !targetDepartment || !reason.trim() || availableDepartments.length === 0} className="bg-orange-600 hover:bg-orange-700">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reverting...
              </>
            ) : (
              <>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Revert Ticket
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
