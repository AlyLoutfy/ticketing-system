"use client";

import { CheckCircle, Clock, XCircle, AlertTriangle, User, Building } from "lucide-react";
import { WorkflowResolution } from "@/lib/storage";

interface WorkflowHistoryTooltipProps {
  resolutions: WorkflowResolution[];
  currentStep: number;
  totalSteps: number;
  currentDepartment?: string;
  ticketCreatedAt: Date;
}

export function WorkflowHistoryTooltip({ resolutions, currentStep, totalSteps, currentDepartment, ticketCreatedAt }: WorkflowHistoryTooltipProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (value: number, unit: string) => {
    if (unit === "days") {
      return value === 1 ? "1 day" : `${value} days`;
    } else if (unit === "hours") {
      return value === 1 ? "1 hour" : `${value} hours`;
    } else if (unit === "weeks") {
      return value === 1 ? "1 week" : `${value} weeks`;
    }
    return `${value} ${unit}`;
  };

  const getSLAStatusIcon = (status?: string) => {
    switch (status) {
      case "met":
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case "missed":
        return <XCircle className="w-3 h-3 text-red-500" />;
      case "exceeded":
        return <AlertTriangle className="w-3 h-3 text-blue-500" />;
      default:
        return <Clock className="w-3 h-3 text-gray-400" />;
    }
  };

  const getSLAStatusText = (status?: string) => {
    switch (status) {
      case "met":
        return "SLA Met";
      case "missed":
        return "SLA Missed";
      case "exceeded":
        return "SLA Exceeded";
      default:
        return "No SLA Data";
    }
  };

  const getSLAStatusColor = (status?: string) => {
    switch (status) {
      case "met":
        return "text-green-600";
      case "missed":
        return "text-red-600";
      case "exceeded":
        return "text-blue-600";
      default:
        return "text-gray-500";
    }
  };

  // Sort resolutions by step number
  const sortedResolutions = [...resolutions].sort((a, b) => a.stepNumber - b.stepNumber);

  return (
    <div className="space-y-3 max-w-sm">
      {/* Header */}
      <div className="border-b border-gray-200 pb-2">
        <h4 className="font-semibold text-sm text-gray-900">Workflow History</h4>
        <p className="text-xs text-gray-600">
          Step {currentStep} of {totalSteps} • Created {formatDate(ticketCreatedAt)}
        </p>
      </div>

      {/* Current Status */}
      {currentDepartment && (
        <div className="p-2 bg-blue-50 rounded border border-blue-200">
          <div className="flex items-center gap-2 text-sm">
            <Building className="w-3 h-3 text-blue-600" />
            <span className="font-medium text-blue-900">Current:</span>
            <span className="text-blue-700">{currentDepartment}</span>
          </div>
        </div>
      )}

      {/* Workflow Steps */}
      <div className="space-y-2">
        {sortedResolutions.length > 0 ? (
          sortedResolutions.map((resolution) => (
            <div key={resolution.id} className="border-l-2 border-gray-200 pl-3 pb-2">
              {/* Step Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span className="text-xs font-medium text-gray-700">Step {resolution.stepNumber}</span>
                  {resolution.isRevert && <span className="text-xs bg-orange-100 text-orange-700 px-1 rounded">REVERT</span>}
                </div>
                <span className="text-xs text-gray-500">{formatDate(resolution.resolvedAt)}</span>
              </div>

              {/* Department & User */}
              <div className="mt-1 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <Building className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-700">{resolution.fromDepartment}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <User className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-600">{resolution.resolvedBy}</span>
                </div>
              </div>

              {/* SLA Information */}
              {resolution.expectedSLA && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-700">SLA Performance</span>
                    <div className="flex items-center gap-1">
                      {getSLAStatusIcon(resolution.slaStatus)}
                      <span className={getSLAStatusColor(resolution.slaStatus)}>{getSLAStatusText(resolution.slaStatus)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Expected:</span>
                      <div className="font-medium">{formatDuration(resolution.expectedSLA.value, resolution.expectedSLA.unit)}</div>
                    </div>
                    {resolution.actualTimeTaken && (
                      <div>
                        <span className="text-gray-500">Actual:</span>
                        <div className="font-medium">{formatDuration(resolution.actualTimeTaken.value, resolution.actualTimeTaken.unit)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Resolution Text Preview */}
              {resolution.resolutionText && (
                <div className="mt-2 text-xs text-gray-600 bg-white p-2 rounded border">
                  <div className="font-medium text-gray-700 mb-1">Resolution:</div>
                  <div className="line-clamp-2">{resolution.resolutionText.length > 100 ? `${resolution.resolutionText.substring(0, 100)}...` : resolution.resolutionText}</div>
                </div>
              )}

              {/* Attachments */}
              {resolution.attachments && resolution.attachments.length > 0 && <div className="mt-1 text-xs text-gray-500">📎 {resolution.attachments.length} file(s) attached</div>}
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-gray-500 text-sm">
            <Clock className="w-6 h-6 mx-auto mb-2 text-gray-300" />
            <div>No workflow history yet</div>
            <div className="text-xs">This ticket hasn&apos;t been processed by any departments</div>
          </div>
        )}
      </div>

      {/* Summary */}
      {sortedResolutions.length > 0 && (
        <div className="border-t border-gray-200 pt-2">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Total Milestones Completed: {sortedResolutions.length}</span>
            <span>{sortedResolutions.filter((r) => r.slaStatus === "met").length} SLA Met</span>
          </div>
        </div>
      )}
    </div>
  );
}
