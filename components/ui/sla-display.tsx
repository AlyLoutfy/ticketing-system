"use client";

import { useEffect, useState } from "react";
import { formatSLA, parseSLA, SLA } from "@/lib/utils/sla-formatter";

interface SLADisplayProps {
  sla: SLA | string | undefined | null;
  className?: string;
}

export function SLADisplay({ sla, className = "" }: SLADisplayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className={className}>-</span>;
  }

  // Handle null, undefined, or empty SLA
  if (!sla) {
    return <span className={className}>-</span>;
  }

  const formattedSLA = typeof sla === "object" ? formatSLA(sla) : formatSLA(parseSLA(sla));

  return <span className={className}>{formattedSLA}</span>;
}
