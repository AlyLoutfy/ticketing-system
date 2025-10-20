"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { storage, TicketHistory } from "@/lib/storage";
import { formatDateTime } from "@/lib/utils/date-calculator";
import { History, User, Clock } from "lucide-react";

interface TicketHistoryProps {
  ticketId: string;
}

export default function TicketHistoryComponent({ ticketId }: TicketHistoryProps) {
  const [history, setHistory] = useState<TicketHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [ticketId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadHistory = async () => {
    try {
      const ticketHistory = await storage.getTicketHistory(ticketId);
      setHistory(ticketHistory);
    } catch (error) {
      console.error("Error loading ticket history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: string | number | Date | { value: number; unit: "hours" | "days" } | null | undefined): string => {
    if (value === null || value === undefined) return "Not set";
    if (typeof value === "string") return value;
    if (typeof value === "number") return value.toString();
    if (value instanceof Date) return formatDateTime(value);
    if (typeof value === "object" && "value" in value && "unit" in value) {
      return `${value.value}${value.unit === "hours" ? "h" : "WD"}`;
    }
    return String(value);
  };

  const getFieldDisplayName = (field: string): string => {
    const fieldNames: { [key: string]: string } = {
      department: "Department",
      ticketType: "Ticket Type",
      assignee: "Assignee",
      clientName: "Client Name",
      workingDays: "Working Days",
      priority: "Priority",
      status: "Status",
      description: "Description",
      dueDate: "Due Date",
    };
    return fieldNames[field] || field;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Version History
          </CardTitle>
          <CardDescription>No changes have been made to this ticket</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>This ticket has not been modified since creation</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Version History
        </CardTitle>
        <CardDescription>
          {history.length} change{history.length !== 1 ? "s" : ""} made to this ticket
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((entry, index) => (
            <div key={entry.id} className="border-l-2 border-gray-200 pl-4 relative">
              <div className="absolute -left-2 top-0 w-4 h-4 bg-white border-2 border-gray-300 rounded-full"></div>

              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium">{formatDateTime(entry.changedAt)}</span>
                  {index === 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Latest
                    </Badge>
                  )}
                </div>
                {entry.changedBy && (
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <User className="w-3 h-3" />
                    {entry.changedBy}
                  </div>
                )}
              </div>

              {entry.reason && (
                <div className="mb-3 p-2 bg-gray-50 rounded text-sm">
                  <strong>Reason:</strong> {entry.reason}
                </div>
              )}

              <div className="space-y-2">
                {entry.changes.map((change, changeIndex) => (
                  <div key={changeIndex} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        {getFieldDisplayName(change.field)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">From:</span>
                        <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-800">{formatValue(change.oldValue)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">To:</span>
                        <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded text-green-800">{formatValue(change.newValue)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
