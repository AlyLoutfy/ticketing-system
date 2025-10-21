"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { storage } from "@/lib/storage";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle, PlayCircle } from "lucide-react";
import { WorkflowStepStatus, Ticket } from "@/lib/storage";

interface DepartmentActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (isComplete: boolean, notes: string, assignee?: string) => void;
  ticket: Ticket | null;
  currentStep: WorkflowStepStatus | null;
}

export function DepartmentActionModal({ isOpen, onClose, onConfirm, ticket, currentStep }: DepartmentActionModalProps) {
  const [notes, setNotes] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [departmentUsers, setDepartmentUsers] = useState<string[]>([]);

  React.useEffect(() => {
    const loadUsers = async () => {
      if (ticket?.department) {
        await storage.init();
        const users = await storage.getUsersByDepartment(ticket.department);
        setDepartmentUsers(users.map((u) => u.name));
      } else {
        setDepartmentUsers([]);
      }
    };
    loadUsers();
  }, [ticket]);

  const handleSubmit = async () => {
    if (!notes.trim()) {
      alert("Please enter notes about your action");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(isComplete, notes, assignee.trim() ? assignee.trim() : undefined);
      // Reset form
      setNotes("");
      setIsComplete(false);
      setAssignee("");
      onClose();
    } catch (error) {
      console.error("Error submitting action:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNotes("");
    setIsComplete(false);
    setAssignee("");
    onClose();
  };

  if (!ticket || !currentStep) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5" />
            Take Action on Ticket
          </DialogTitle>
          <DialogDescription>Provide details about the action you&apos;re taking on this ticket</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Ticket Info */}
          <Card>
            <CardContent className="px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Ticket #{ticket.id}</h3>
                  <p className="text-xs text-gray-600">
                    {ticket.clientName} - {ticket.ticketType}
                  </p>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs py-1">
                  Step {currentStep.stepNumber}: {currentStep.departmentName}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Action Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">What is the status from your department?</Label>
            <RadioGroup value={isComplete.toString()} onValueChange={(value) => setIsComplete(value === "true")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="step" />
                <Label htmlFor="step" className="flex items-center gap-2 cursor-pointer">
                  <PlayCircle className="w-4 h-4 text-blue-600" />
                  <span>In progress (a step in the process)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="complete" />
                <Label htmlFor="complete" className="flex items-center gap-2 cursor-pointer">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Resolved from our department&apos;s side</span>
                </Label>
              </div>
            </RadioGroup>
            {!isComplete && (
              <div className="grid grid-cols-1 gap-2">
                <Label className="text-sm text-gray-700">Reassign to (optional)</Label>
                <Select value={assignee} onValueChange={(v) => setAssignee(v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select teammate" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentUsers.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">Leave empty to keep current owner.</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <Label htmlFor="notes" className="text-sm font-medium">
              Notes about your action *
            </Label>
            <Textarea id="notes" placeholder="Describe what you did, what you found, or any next steps..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="resize-none" />
            <p className="text-xs text-gray-500">This will be visible to other departments and help track progress</p>
          </div>

          {/* File Upload Placeholder */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Attach files (optional)</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">File upload functionality coming soon</p>
              <p className="text-xs text-gray-400">You can describe files in your notes for now</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !notes.trim()} className="cursor-pointer">
              {isSubmitting ? "Submitting..." : "Submit Action"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
