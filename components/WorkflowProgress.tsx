"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, PlayCircle, ChevronDown } from "lucide-react";
import { WorkflowStepStatus, Ticket } from "@/lib/storage";
import { storage } from "@/lib/storage";

interface WorkflowProgressProps {
  ticket: Ticket;
  onTicketUpdate: (updatedTicket: Ticket) => void;
}

export function WorkflowProgress({ ticket, onTicketUpdate }: WorkflowProgressProps) {
  const currentStep = storage.getCurrentWorkflowStep(ticket);
  const [expandedStep, setExpandedStep] = React.useState<number | null>(null);
  const [displaySteps, setDisplaySteps] = React.useState<WorkflowStepStatus[]>(ticket.workflowStatus || []);

  // Ensure we have the full list of workflow steps even if ticket.workflowStatus is minimal
  React.useEffect(() => {
    const buildSteps = async () => {
      await storage.init();
      // Try to load the assigned workflow (or default)
      let wf = ticket.workflowId ? await storage.getWorkflow(ticket.workflowId) : null;
      if (!wf) {
        wf = await storage.getDefaultWorkflow();
      }

      const existing = ticket.workflowStatus || [];

      if (wf && wf.steps?.length) {
        // Merge statuses from existing into workflow-defined steps
        const merged: WorkflowStepStatus[] = wf.steps.map((step, idx) => {
          const stepNumber = idx + 1;
          const fromExisting = existing.find((s) => s.stepNumber === stepNumber);
          let status: WorkflowStepStatus["status"] = fromExisting?.status || "pending";
          if (!fromExisting) {
            // Infer status from ticket state when not present
            const current = ticket.currentWorkflowStep || 1;
            status = stepNumber < current ? "completed" : stepNumber === current ? (ticket.status === "Resolved" ? "completed" : "in_progress") : "pending";
          }
          return {
            stepNumber,
            departmentId: step.departmentId,
            departmentName: step.departmentName,
            status,
            actions: fromExisting?.actions || [],
            completedAt: fromExisting?.completedAt,
          } as WorkflowStepStatus;
        });

        setDisplaySteps(merged);
        const inProg = merged.find((s) => s.status === "in_progress");
        setExpandedStep(inProg ? inProg.stepNumber : null);
        return;
      }

      if (existing.length) {
        setDisplaySteps(existing);
        const inProg = existing.find((s) => s.status === "in_progress");
        setExpandedStep(inProg ? inProg.stepNumber : null);
        return;
      }

      // Last resort: single step
      const single: WorkflowStepStatus[] = [
        {
          stepNumber: 1,
          departmentId: ticket.department,
          departmentName: ticket.department,
          status: ticket.status === "In Progress" ? "in_progress" : ticket.status === "Resolved" ? "completed" : "pending",
          actions: [],
        },
      ];
      setDisplaySteps(single);
      setExpandedStep(single.find((s) => s.status === "in_progress")?.stepNumber ?? null);
    };

    buildSteps();
  }, [ticket.workflowStatus, ticket.workflowId, ticket.currentWorkflowStep, ticket.status, ticket.department, ticket.createdAt, ticket.updatedAt]);

  const getStepBadgeVariant = (step: WorkflowStepStatus) => {
    switch (step.status) {
      case "completed":
        return "default" as const;
      case "in_progress":
        return "secondary" as const;
      case "pending":
        return "outline" as const;
      default:
        return "outline" as const;
    }
  };

  const getStepBadgeColor = (step: WorkflowStepStatus) => {
    switch (step.status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-gray-100 text-gray-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const toStartCase = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

  const handleStepAction = async (stepNumber: number, action: "in_progress" | "completed") => {
    try {
      const notes = action === "in_progress" ? "Started working on this step" : "Completed this step";
      const isComplete = action === "completed";
      const updatedTicket = await storage.addDepartmentAction(ticket.id, stepNumber, action, notes, isComplete);
      onTicketUpdate(updatedTicket);
    } catch (error) {
      console.error("Error updating workflow step:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <PlayCircle className="w-5 h-5" />
          Workflow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {displaySteps.map((step) => {
          const isExpanded = expandedStep === step.stepNumber;
          const borderColor = step.status === "completed" ? "border-green-200" : step.status === "in_progress" ? "border-blue-200" : "border-gray-200";
          const leftBar = step.status === "completed" ? "bg-green-500" : step.status === "in_progress" ? "bg-blue-500" : "bg-gray-300";
          return (
            <div key={step.stepNumber} className={`border rounded-lg ${borderColor}`}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedStep(isExpanded ? null : step.stepNumber)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedStep(isExpanded ? null : step.stepNumber);
                  }
                }}
                className="w-full text-left cursor-pointer hover:bg-gray-50 rounded-md"
              >
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : "rotate-0"}`} />
                    <div className={`w-2 h-2 rounded-full ${leftBar}`}></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">Step {step.stepNumber}</span>
                        <Badge variant={getStepBadgeVariant(step)} className={getStepBadgeColor(step)}>
                          {toStartCase(step.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{step.departmentName}</p>
                      {step.completedAt && <p className="text-xs text-gray-500">Completed: {step.completedAt.toLocaleDateString()}</p>}
                    </div>
                  </div>
                  {currentStep?.stepNumber === step.stepNumber && step.status !== "completed" && (
                    <div className="flex gap-2">
                      {step.status === "in_progress" && (
                        <Button size="sm" onClick={() => handleStepAction(step.stepNumber, "completed")} className="cursor-pointer">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Complete
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="p-3 bg-gray-50 border-t">
                  <h4 className="text-xs font-medium text-gray-700 mb-2">Actions ({step.actions?.length || 0})</h4>
                  {step.actions && step.actions.length > 0 ? (
                    <div className="space-y-2">
                      {step.actions.map((action) => (
                        <div key={action.id} className="flex items-start gap-2 p-3 bg-white rounded border min-h-[76px]">
                          <div className="flex-shrink-0 mt-0.5">{action.actionType === "completed" ? <CheckCircle className="w-3 h-3 text-green-600" /> : <PlayCircle className="w-3 h-3 text-blue-600" />}</div>
                          <div className="flex-1 min-w-0">
                            <div className="relative mb-1 pr-40">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-700">{action.actionType === "completed" ? "Completed" : "In Progress"}</span>
                                {action.isComplete && (
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                    Final Action
                                  </Badge>
                                )}
                                <span className="text-xs text-gray-500">{action.timestamp.toLocaleString()}</span>
                              </div>
                              <div className="absolute right-0 top-0 flex flex-col items-end gap-1">
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                  Assignee: {action.performedBy || ticket.assignee || "—"}
                                </Badge>
                                {action.newAssignee && (
                                  <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                                    New Assignee: {action.newAssignee}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-gray-600">{action.notes}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No actions yet</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Workflow Summary */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Progress: {displaySteps.filter((s) => s.status === "completed").length} / {displaySteps.length} steps
            </span>
            <span className="text-gray-500">Current: {currentStep?.departmentName || "None"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
