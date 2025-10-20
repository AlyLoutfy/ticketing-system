"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { storage, User } from "@/lib/storage";
import { showToast } from "@/components/ui/client-toast";

interface ReassignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  currentAssignee?: string;
  currentDepartment?: string;
  onReassigned: (newAssignee: string) => void;
}

export function ReassignmentModal({ isOpen, onClose, ticketId, currentAssignee, currentDepartment, onReassigned }: ReassignmentModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const departmentUsers = await storage.getUsersByDepartment(currentDepartment || "");
      setUsers(departmentUsers);
    } catch (error) {
      console.error("Error loading users:", error);
      showToast("Error loading users", "error");
    }
  }, [currentDepartment]);

  useEffect(() => {
    if (isOpen && currentDepartment) {
      loadUsers();
    }
  }, [isOpen, currentDepartment, loadUsers]);

  const handleReassign = async () => {
    if (!selectedAssignee) {
      showToast("Please select an assignee", "error");
      return;
    }

    if (selectedAssignee === currentAssignee) {
      showToast("Please select a different assignee", "error");
      return;
    }

    setLoading(true);
    try {
      await storage.reassignTicket(ticketId, selectedAssignee);
      showToast("Ticket reassigned successfully!", "success");
      onReassigned(selectedAssignee);
      onClose();
      setSelectedAssignee("");
    } catch (error) {
      console.error("Error reassigning ticket:", error);
      showToast("Failed to reassign ticket", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign Ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600">Current Assignee</label>
            <p className="text-sm text-gray-900 mt-1">{currentAssignee || "—"}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Reassign To</label>
            <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select new assignee" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.name}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleReassign} disabled={loading || !selectedAssignee}>
              {loading ? "Reassigning..." : "Reassign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
