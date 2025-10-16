"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Workflow } from "@/lib/storage";

interface WorkflowSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  workflows: Workflow[];
  placeholder?: string;
  className?: string;
}

export function WorkflowSelect({ value, onValueChange, workflows, placeholder = "Select workflow", className }: WorkflowSelectProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No Workflow</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No Workflow</SelectItem>
        {workflows.map((workflow) => (
          <SelectItem key={workflow.id} value={workflow.id}>
            <div className="flex items-center justify-between w-full">
              <span>{workflow.name}</span>
              {workflow.isDefault && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Default
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

