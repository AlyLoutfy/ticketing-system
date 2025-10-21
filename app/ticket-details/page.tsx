"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowProgress } from "@/components/WorkflowProgress";
import { ReassignmentModal } from "@/components/ReassignmentModal";
import { storage, Ticket, Workflow } from "@/lib/storage";
import { formatDate, getPriorityColor, getStatusColor, getDaysUntilDue, isOverdue } from "@/lib/utils/date-calculator";
import { SLADisplay } from "@/components/ui/sla-display";
import { ArrowLeft, Calendar, Clock, User, Building, FileText, AlertTriangle, CheckCircle, Edit, X, Home, Ticket as TicketIcon, Workflow as WorkflowIcon } from "lucide-react";
import Link from "next/link";

function TicketDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("id");

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReassignmentModal, setShowReassignmentModal] = useState(false);

  const loadWorkflowResolutions = useCallback(async () => {
    if (!ticketId) return;
    try {
      await storage.getWorkflowResolutions(ticketId);
    } catch (err) {
      console.error("Error loading workflow resolutions:", err);
    }
  }, [ticketId]);

  const getWorkflowSLA = (ticket: Ticket): { value: number; unit: "hours" | "days" } => {
    const workflowId = ticket.workflowId;

    if (!workflowId) {
      // If no workflow assigned, use default workflow
      const defaultWorkflow = workflows.find((w) => w.isDefault);
      if (!defaultWorkflow) {
        // Fallback to ticket's own SLA if no default workflow exists
        return ticket.sla || { value: 7, unit: "days" as const };
      }

      const totalDays = defaultWorkflow.steps.reduce((total, step) => total + (step.estimatedDays || 1), 0);
      const unit = defaultWorkflow.steps[0]?.slaUnit || "days";
      return {
        value: totalDays,
        unit: unit === "hours" ? ("hours" as const) : ("days" as const),
      };
    }

    const workflow = workflows.find((w) => w.id === workflowId);
    if (!workflow) {
      // Fallback to ticket's own SLA if workflow not found
      return ticket.sla || { value: 7, unit: "days" as const };
    }

    const totalDays = workflow.steps.reduce((total, step) => total + (step.estimatedDays || 1), 0);
    const unit = workflow.steps[0]?.slaUnit || "days";
    return {
      value: totalDays,
      unit: unit === "hours" ? ("hours" as const) : ("days" as const),
    };
  };

  const getAssignedWorkflow = (workflowId?: string): Workflow | null => {
    if (workflowId) {
      const found = workflows.find((w) => w.id === workflowId);
      if (found) return found;
    }
    // fallback to default workflow
    const def = workflows.find((w) => w.isDefault);
    return def || null;
  };

  const getWorkflowName = (workflowId?: string) => {
    const wf = getAssignedWorkflow(workflowId);
    return wf ? wf.name : "Unknown";
  };

  useEffect(() => {
    const loadTicketDetails = async () => {
      if (!ticketId) {
        setError("No ticket ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        await storage.init();

        // Load ticket
        const ticketData = await storage.getTicket(ticketId);
        if (!ticketData) {
          setError("Ticket not found");
          return;
        }
        setTicket(ticketData);

        // Load workflow resolutions
        await loadWorkflowResolutions();

        // Load workflows
        const workflowsData = await storage.getWorkflows();
        setWorkflows(workflowsData);
      } catch (err) {
        console.error("Error loading ticket details:", err);
        setError("Failed to load ticket details");
      } finally {
        setLoading(false);
      }
    };

    loadTicketDetails();
  }, [ticketId, loadWorkflowResolutions]);

  const handleClose = async () => {
    if (!ticket) return;

    if (confirm("Are you sure you want to close this ticket? This action will archive the ticket.")) {
      try {
        await storage.closeTicket(ticket.id);
        router.push("/");
      } catch (err) {
        console.error("Error closing ticket:", err);
        alert("Failed to close ticket. Please try again.");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading ticket details...</p>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Ticket Not Found</h1>
          <p className="text-gray-600 mb-6">{error || "The requested ticket could not be found."}</p>
          <Button onClick={() => router.push("/")} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Tickets
          </Button>
        </div>
      </div>
    );
  }

  const getTicketNumber = (id: string) => {
    const match = id.match(/\d+/);
    if (!match) return id;
    const digits = match[0];
    return digits.length > 4 ? digits.slice(-4) : digits;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => router.push("/")} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Tickets
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <TicketIcon className="w-6 h-6 text-blue-600" />
                  {ticket.ticketType}
                </h1>
                <p className="text-sm text-gray-600">
                  Ticket {getTicketNumber(ticket.id)} • Created {formatDate(ticket.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/ticket?id=${ticket.id}&mode=edit`}>
                <Button variant="outline" className="flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  Edit Ticket
                </Button>
              </Link>
              <Button variant="outline" onClick={handleClose} className="flex items-center gap-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50">
                <X className="w-4 h-4" />
                Close Ticket
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Ticket Details */}
          <div className="lg:col-span-1 space-y-6">
            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Status & Priority
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Status</span>
                  <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
                </div>
                {ticket.status === "Overdue" && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-700">This ticket is overdue</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Priority</span>
                  <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Days Left</span>
                  <span className={`text-sm font-medium ${getDaysUntilDue(ticket.dueDate) < 0 ? "text-red-600" : getDaysUntilDue(ticket.dueDate) <= 1 ? "text-orange-600" : "text-green-600"}`}>
                    {(() => {
                      const daysLeft = getDaysUntilDue(ticket.dueDate);
                      if (daysLeft < 0) {
                        return `${Math.abs(daysLeft)} days overdue`;
                      } else if (daysLeft === 0) {
                        return "Due today";
                      } else {
                        return `${daysLeft} days remaining`;
                      }
                    })()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Ticket Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Ticket Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Department</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Building className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{ticket.department}</span>
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Ticket Type</span>
                  <p className="text-sm text-gray-900 mt-1 flex items-center gap-2">
                    <TicketIcon className="w-4 h-4 text-blue-600" />
                    {ticket.ticketType}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Assigned Workflow</span>
                  <div className="flex items-center gap-2 mt-1">
                    <WorkflowIcon className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-gray-900">{getWorkflowName(ticket.workflowId)}</span>
                    {(() => {
                      const wf = getAssignedWorkflow(ticket.workflowId);
                      return wf?.isDefault ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">Default</span> : null;
                    })()}
                  </div>
                </div>
                {ticket.subCategory && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Sub-Category</span>
                    <p className="text-sm text-gray-900 mt-1">{ticket.subCategory}</p>
                  </div>
                )}
                <div>
                  <span className="text-sm font-medium text-gray-600">Client Name</span>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{ticket.clientName}</span>
                  </div>
                </div>
                {ticket.unitId && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Unit ID</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Home className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">{ticket.unitId}</span>
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-sm font-medium text-gray-600">Ticket Owner</span>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{ticket.ticketOwner}</span>
                  </div>
                  <div className="mt-3">
                    <span className="text-sm font-medium text-gray-600">Current Assignee</span>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{ticket.assignee || "—"}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setShowReassignmentModal(true)} className="text-xs h-7 px-2">
                        <Edit className="w-3 h-3 mr-1" />
                        Reassign
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SLA Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  SLA Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Total SLA</span>
                  <div className="mt-1">
                    <SLADisplay sla={getWorkflowSLA(ticket)} />
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Created</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{formatDate(ticket.createdAt)}</span>
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Due Date</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className={`text-sm ${isOverdue(ticket.dueDate) ? "text-red-600 font-medium" : "text-gray-900"}`}>{formatDate(ticket.dueDate)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            {ticket.description && (
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{ticket.description}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Workflow (merged timeline + progress) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Workflow Progress */}
            <WorkflowProgress
              ticket={ticket}
              onTicketUpdate={(updatedTicket) => {
                setTicket(updatedTicket);
                // Refresh workflow resolutions
                loadWorkflowResolutions();
              }}
            />
          </div>
        </div>
      </div>

      {/* Reassignment Modal */}
      <ReassignmentModal
        isOpen={showReassignmentModal}
        onClose={() => setShowReassignmentModal(false)}
        ticketId={ticket.id}
        currentAssignee={ticket.assignee}
        currentDepartment={ticket.currentDepartment}
        onReassigned={(newAssignee) => {
          setTicket((prev) => (prev ? { ...prev, assignee: newAssignee } : null));
          setShowReassignmentModal(false);
        }}
      />
    </div>
  );
}

export default function TicketDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading ticket details...</p>
          </div>
        </div>
      }
    >
      <TicketDetailsContent />
    </Suspense>
  );
}
