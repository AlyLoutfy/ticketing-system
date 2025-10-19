"use client";

import { CheckCircle, Clock, XCircle, User, Building, Calendar, FileText, ArrowLeft } from "lucide-react";
import { WorkflowResolution } from "@/lib/storage";

interface WorkflowTimelineProps {
  resolutions: WorkflowResolution[];
  currentStep: number;
  totalSteps: number;
  currentDepartment?: string;
  ticketCreatedAt: Date;
  ticketStatus: string;
  workflowDepartments?: string[]; // Array of departments in workflow order
}

export function WorkflowTimeline({ resolutions, currentStep, totalSteps, currentDepartment, ticketCreatedAt, workflowDepartments }: WorkflowTimelineProps) {
  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
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
      default:
        return null;
    }
  };

  const getSLAStatusText = (status?: string) => {
    switch (status) {
      case "met":
        return "SLA Met";
      case "missed":
        return "SLA Missed";
      default:
        return "";
    }
  };

  // Sort resolutions by step number
  const sortedResolutions = [...resolutions].sort((a, b) => a.stepNumber - b.stepNumber);

  // Function to get department for a step
  const getDepartmentForStep = (stepNumber: number): string => {
    // If we have workflow departments defined, use them
    if (workflowDepartments && workflowDepartments.length >= stepNumber) {
      return workflowDepartments[stepNumber - 1];
    }

    // Fallback: try to determine from existing resolutions
    const resolution = sortedResolutions.find((r) => r.stepNumber === stepNumber);
    if (resolution) {
      return resolution.fromDepartment;
    }

    // Default fallback departments based on step
    const defaultDepartments = ["Initial Department", "Review Department", "Final Department"];

    return defaultDepartments[stepNumber - 1] || `Department ${stepNumber}`;
  };

  // Create timeline items including current step if not completed
  const timelineItems: Array<{
    type: "completed" | "current" | "future";
    step: number;
    resolution?: WorkflowResolution;
    isRevert?: boolean;
    department?: string;
  }> = [];

  // Add completed steps
  sortedResolutions.forEach((resolution) => {
    timelineItems.push({
      type: "completed",
      step: resolution.stepNumber,
      resolution,
      isRevert: resolution.isRevert,
    });
  });

  // Add current step if not completed
  if (currentStep <= totalSteps && !sortedResolutions.some((r) => r.stepNumber === currentStep)) {
    timelineItems.push({
      type: "current",
      step: currentStep,
      department: currentDepartment,
    });
  }

  // Add future steps
  for (let i = currentStep + 1; i <= totalSteps; i++) {
    timelineItems.push({
      type: "future",
      step: i,
    });
  }

  // Sort timeline items by step
  timelineItems.sort((a, b) => a.step - b.step);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Workflow Timeline</h3>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>Created {formatDateTime(ticketCreatedAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4" />
            <span>
              Step {currentStep} of {totalSteps}
            </span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        <div className="space-y-8">
          {timelineItems.map((item) => (
            <div key={item.step} className="relative flex items-start gap-4">
              {/* Timeline Node */}
              <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 bg-white">
                {item.type === "completed" ? (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                ) : item.type === "current" ? (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 animate-pulse">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200">
                    <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {item.type === "completed" && item.resolution ? (
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    {/* Step Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg font-semibold text-gray-900">Step {item.step}</h4>
                        {item.isRevert && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                            <ArrowLeft className="w-3 h-3" />
                            REVERT
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{formatDateTime(item.resolution.resolvedAt)}</div>
                    </div>

                    {/* Department and User */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <Building className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.resolution.fromDepartment}</div>
                          <div className="text-xs text-gray-500">Department</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.resolution.resolvedBy}</div>
                          <div className="text-xs text-gray-500">Resolved By</div>
                        </div>
                      </div>
                    </div>

                    {/* SLA Performance */}
                    {item.resolution.expectedSLA && (
                      <div className="mb-3">
                        {/* Compact SLA Status at Top */}
                        {item.resolution.slaStatus && item.resolution.slaStatus !== "exceeded" && (
                          <div className="flex items-center gap-1 mb-2">
                            {getSLAStatusIcon(item.resolution.slaStatus)}
                            <span className="text-xs font-medium text-gray-700">{getSLAStatusText(item.resolution.slaStatus)}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-2 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">SLA</div>
                            <div className="font-semibold text-gray-900">{formatDuration(item.resolution.expectedSLA.value, item.resolution.expectedSLA.unit)}</div>
                          </div>
                          {item.resolution.actualTimeTaken && (
                            <div className="p-2 bg-gray-50 rounded-lg">
                              <div className="text-xs text-gray-500 mb-1">Actual Time</div>
                              <div className="font-semibold text-gray-900">{formatDuration(item.resolution.actualTimeTaken.value, item.resolution.actualTimeTaken.unit)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Resolution Details */}
                    <div className="mb-3">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Resolution Details</h5>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{item.resolution.resolutionText}</p>
                      </div>
                    </div>

                    {/* Attachments */}
                    {item.resolution.attachments && item.resolution.attachments.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Attachments</h5>
                        <div className="flex flex-wrap gap-2">
                          {item.resolution.attachments.map((attachment) => (
                            <div key={attachment.id} className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded-lg">
                              <FileText className="w-3 h-3 text-gray-400" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">{attachment.name}</div>
                                <div className="text-xs text-gray-500">{Math.round(attachment.size / 1024)} KB</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : item.type === "current" ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-semibold text-blue-900">Step {item.step} - In Progress</h4>
                      <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        CURRENT
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-blue-100 rounded-lg">
                      <Building className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="text-sm font-medium text-blue-900">{item.department || "Not assigned"}</div>
                        <div className="text-xs text-blue-700">Current Department</div>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-blue-800">This ticket is currently being processed by {item.department || "an unassigned department"}.</div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-semibold text-gray-600">Step {item.step} - Pending</h4>
                      <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        PENDING
                      </div>
                    </div>

                    {/* Department Information */}
                    <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg mb-2">
                      <Building className="w-4 h-4 text-gray-500" />
                      <div>
                        <div className="text-sm font-medium text-gray-700">{getDepartmentForStep(item.step)}</div>
                        <div className="text-xs text-gray-500">Assigned Department</div>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600">This step is waiting to be processed by {getDepartmentForStep(item.step)}.</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      {sortedResolutions.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{sortedResolutions.length}</div>
              <div className="text-sm text-gray-600">Steps Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{sortedResolutions.filter((r) => r.slaStatus === "met").length}</div>
              <div className="text-sm text-gray-600">SLA Met</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{sortedResolutions.filter((r) => r.slaStatus === "missed").length}</div>
              <div className="text-sm text-gray-600">SLA Missed</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
