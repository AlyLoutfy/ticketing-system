"use client";

import { CheckCircle, Circle, Clock } from "lucide-react";
import { WorkflowResolution } from "@/lib/storage";

interface WorkflowProgressProps {
  currentStep: number;
  totalSteps: number;
  resolutions: WorkflowResolution[];
  currentDepartment?: string;
}

export function WorkflowProgress({ currentStep, totalSteps, resolutions, currentDepartment }: WorkflowProgressProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-900">Workflow Progress</h4>
      <div className="flex items-center space-x-4">
        {steps.map((step) => {
          const resolution = resolutions.find((r) => r.stepNumber === step);
          const isCompleted = resolution?.isFinalResolution || false;
          const isCurrent = step === currentStep;
          const isPast = step < currentStep;

          return (
            <div key={step} className="flex items-center">
              <div className="flex items-center">
                {isCompleted ? <CheckCircle className="w-5 h-5 text-green-500" /> : isCurrent ? <Clock className="w-5 h-5 text-blue-500" /> : <Circle className="w-5 h-5 text-gray-300" />}
                <span className={`ml-2 text-sm ${isCompleted ? "text-green-600 font-medium" : isCurrent ? "text-blue-600 font-medium" : "text-gray-500"}`}>Step {step}</span>
              </div>
              {step < totalSteps && <div className={`w-8 h-0.5 mx-2 ${isPast || isCompleted ? "bg-green-300" : "bg-gray-200"}`} />}
            </div>
          );
        })}
      </div>

      {currentDepartment && (
        <div className="text-sm text-gray-600">
          <span className="font-medium">Current Department:</span> {currentDepartment}
        </div>
      )}

      {resolutions.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700">Completed Steps:</h5>
          {resolutions.map((resolution) => (
            <div key={resolution.id} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
              <div className="font-medium">
                Step {resolution.stepNumber}: {resolution.fromDepartment}
              </div>
              <div className="text-gray-500 mt-1">{resolution.resolutionText.substring(0, 100)}...</div>
              {resolution.attachments && resolution.attachments.length > 0 && <div className="text-gray-500 mt-1">📎 {resolution.attachments.length} file(s) attached</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

