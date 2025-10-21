"use client";

import { CheckCircle, Circle, Clock } from "lucide-react";
import { WorkflowResolution, WorkflowStepStatus } from "@/lib/storage";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface WorkflowProgressBadgeProps {
  currentStep: number;
  totalSteps: number;
  resolutions: WorkflowResolution[];
  isFullyResolved?: boolean;
  status: string;
  ticketCreatedAt: Date;
  workflowStatus?: WorkflowStepStatus[];
}

export function WorkflowProgressBadge({ totalSteps, resolutions, isFullyResolved, status, workflowStatus }: WorkflowProgressBadgeProps) {
  // Use new workflow status if available, otherwise fall back to old system
  const completedSteps = workflowStatus ? workflowStatus.filter((step) => step.status === "completed" || step.status === "in_progress").length : resolutions.length;

  const totalWorkflowSteps = workflowStatus?.length || totalSteps;
  const isCompleted = isFullyResolved || status === "Resolved";

  // Get current step info from workflow status
  const currentStepInfo = workflowStatus?.find((step) => step.status === "in_progress") || workflowStatus?.find((step) => step.status === "pending");

  // Determine badge color based on status
  const getBadgeColor = () => {
    if (isCompleted) return "bg-green-100 text-green-800 border-green-200";
    if (status === "Overdue") return "bg-red-100 text-red-800 border-red-200";
    if (status === "In Progress") return "bg-blue-100 text-blue-800 border-blue-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  // Get status icon
  const getStatusIcon = () => {
    if (isCompleted) return <CheckCircle className="w-3 h-3" />;
    if (status === "Overdue") return <Clock className="w-3 h-3" />;
    return <Circle className="w-3 h-3" />;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getBadgeColor()}`}>
          {getStatusIcon()}
          <span>
            {completedSteps}/{totalWorkflowSteps}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <div className="space-y-2">
          <div className="font-medium text-sm">Workflow Progress</div>
          <div className="text-xs">
            <div>
              <span className="font-medium">Status:</span> {status}
            </div>
            <div>
              <span className="font-medium">Steps Completed:</span> {completedSteps} of {totalWorkflowSteps}
            </div>
            {currentStepInfo && (
              <div>
                <span className="font-medium">Current Department:</span> {currentStepInfo.departmentName}
              </div>
            )}
          </div>

          {resolutions.length > 0 && (
            <div className="space-y-1">
              <div className="font-medium text-xs">Completed Steps:</div>
              {resolutions.slice(0, 3).map((resolution) => (
                <div key={resolution.id} className="text-xs text-gray-600">
                  <div className="font-medium">
                    Step {resolution.stepNumber}: {resolution.fromDepartment}
                  </div>
                  <div className="text-gray-500 truncate">{resolution.resolutionText.substring(0, 50)}...</div>
                </div>
              ))}
              {resolutions.length > 3 && <div className="text-xs text-gray-500">...and {resolutions.length - 3} more</div>}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
