"use client";

import { useEffect, useState } from "react";
import { Workflow } from "@/lib/storage";

interface WorkflowSLADisplayProps {
  workflowId?: string;
  workflows: Workflow[];
}

export function WorkflowSLADisplay({ workflowId, workflows }: WorkflowSLADisplayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span>-</span>;
  }

  const selectedWorkflow = workflows.find((w) => w.id === workflowId);
  if (!selectedWorkflow) {
    return <span>-</span>;
  }

  // Calculate total SLA from workflow steps
  const totalSLA = selectedWorkflow.steps.reduce((total, step) => {
    const stepSLA = step.estimatedDays || 1;
    return total + stepSLA;
  }, 0);
  const unit = selectedWorkflow.steps[0]?.slaUnit || "days";

  return <span>{`${totalSLA} ${unit === "hours" ? "h" : "WD"}`}</span>;
}

