"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { storage, Ticket, Department } from "@/lib/storage";
import { calculateDueDate as calculateSLADueDate } from "@/lib/utils/sla-formatter";
import { SLADisplay } from "@/components/ui/sla-display";
import { formatDateTime, getPriorityColor, getStatusColor, isOverdue, getDaysUntilDue, formatDate } from "@/lib/utils/date-calculator";
import { ArrowLeft, Edit, Calendar, AlertTriangle, User as UserIcon, Building, Clock, Save } from "lucide-react";
import Link from "next/link";
import { showToast, ClientToastContainer } from "@/components/ui/client-toast";
import TicketHistoryComponent from "@/components/TicketHistory";

function TicketPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ticketId = searchParams.get("id");
  const mode = searchParams.get("mode") || "view"; // view, edit

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    department: "",
    subCategory: "",
    ticketType: "",
    clientName: "",
    unitId: "",
    status: "Open" as "Open" | "In Progress" | "Resolved" | "Rejected" | "Overdue",
    description: "",
  });

  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [estimatedDueDate, setEstimatedDueDate] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);

  const loadData = useCallback(async () => {
    if (!ticketId) return;

    try {
      await storage.init();

      const [ticketData, departmentsData] = await Promise.all([storage.getTicket(ticketId), storage.getDepartments()]);

      if (!ticketData) {
        router.push("/");
        return;
      }

      setTicket(ticketData);
      setDepartments(departmentsData);

      // Find the department
      const department = departmentsData.find((d) => d.name === ticketData.department);
      setSelectedDepartment(department || null);

      // Find the ticket type to get sub-category
      const ticketType = department?.ticketTypes.find((t) => t.name === ticketData.ticketType);

      // Set form data with pre-populated values
      setFormData({
        department: department?.name || "",
        subCategory: ticketData.subCategory || ticketType?.subCategory || "",
        ticketType: ticketType?.id || "",
        clientName: ticketData.clientName,
        unitId: ticketData.unitId || "",
        status: ticketData.status,
        description: ticketData.description || "",
      });
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [ticketId, router]);

  useEffect(() => {
    setMounted(true);
    if (ticketId) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [ticketId, loadData]);

  useEffect(() => {
    // Calculate due date when ticket type changes
    if (selectedDepartment && formData.ticketType && mounted) {
      const ticketType = selectedDepartment.ticketTypes.find((t) => t.id === formData.ticketType);
      if (ticketType) {
        // Calculate SLA from workflow if available, otherwise use defaultWD
        const sla = { value: ticketType.defaultWD, unit: "days" as const };
        const dueDate = calculateSLADueDate(sla, new Date());
        setEstimatedDueDate(dueDate);
      }
    }
  }, [formData.ticketType, selectedDepartment, mounted]);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const handleDepartmentChange = (departmentName: string) => {
    const department = departments.find((d) => d.name === departmentName);
    setSelectedDepartment(department || null);
    setFormData((prev) => ({
      ...prev,
      department: departmentName,
      subCategory: "", // Reset sub-category when department changes
      ticketType: "", // Reset ticket type when department changes
    }));
  };

  const handleSubCategoryChange = (subCategory: string) => {
    setFormData((prev) => ({
      ...prev,
      subCategory,
      ticketType: "", // Reset ticket type when sub-category changes
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDepartment || !formData.ticketType || !formData.clientName.trim() || !ticket) {
      console.error("Validation failed:", { selectedDepartment, ticketType: formData.ticketType, clientName: formData.clientName, ticket });
      return;
    }

    try {
      setSubmitting(true);

      const ticketType = selectedDepartment.ticketTypes.find((t) => t.id === formData.ticketType);
      if (!ticketType) return;

      const updates: Partial<Ticket> = {
        department: selectedDepartment.name,
        ticketType: ticketType.name,
        subCategory: ticketType.subCategory,
        sla: undefined, // SLA is now calculated from workflow
        clientName: formData.clientName.trim(),
        unitId: formData.unitId.trim() || undefined,
        workingDays: ticketType.defaultWD, // Use defaultWD since SLA is now calculated from workflow
        priority: ticketType.priority,
        status: formData.status,
        description: formData.description.trim() || undefined,
      };

      console.log("Updating ticket:", { ticketId, updates });
      await storage.updateTicket(ticketId!, updates);
      console.log("Ticket updated successfully");

      // Show success notification
      showToast("Ticket updated successfully!", "success");

      // Wait a moment for the toast to show, then redirect
      setTimeout(() => {
        console.log("Redirecting to main page...");
        window.location.href = "/";
      }, 1500);
    } catch (error) {
      console.error("Error updating ticket:", error);
      console.error("Error details:", error);
      showToast(`Error updating ticket: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!ticketId || !ticket) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ticket not found</h2>
          <Link href="/">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const daysUntilDue = getDaysUntilDue(ticket.dueDate);
  const overdue = isOverdue(ticket.dueDate) && ticket.status !== "Resolved" && ticket.status !== "Rejected";

  if (mode === "edit") {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => router.push(`/ticket?id=${ticketId}&mode=view`)} className="cursor-pointer">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Ticket
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Ticket {ticket.id.slice(-8)}</h1>
            <p className="text-gray-600">Update ticket information</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Ticket Details</CardTitle>
                <CardDescription>Update the information for this ticket</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label htmlFor="department">Department *</Label>
                      <Select value={formData.department} onValueChange={handleDepartmentChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.name}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="subCategory">Sub-Category *</Label>
                      <Select value={formData.subCategory} onValueChange={handleSubCategoryChange} disabled={!selectedDepartment}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sub-category" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedDepartment &&
                            (selectedDepartment.subCategories || []).map((subCategory) => (
                              <SelectItem key={subCategory} value={subCategory}>
                                {subCategory}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="ticketType">Ticket Type *</Label>
                    <Select value={formData.ticketType} onValueChange={(value) => setFormData((prev) => ({ ...prev, ticketType: value }))} disabled={!formData.subCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select ticket type" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedDepartment &&
                          formData.subCategory &&
                          selectedDepartment.ticketTypes
                            .filter((type) => type.subCategory === formData.subCategory)
                            .map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name} ({type.defaultWD} WD)
                              </SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label htmlFor="clientName">Client Name *</Label>
                      <Input id="clientName" value={formData.clientName} onChange={(e) => setFormData((prev) => ({ ...prev, clientName: e.target.value }))} placeholder="Enter client name" required />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="unitId">Unit ID</Label>
                      <Input id="unitId" value={formData.unitId} onChange={(e) => setFormData((prev) => ({ ...prev, unitId: e.target.value }))} placeholder="Enter unit ID (optional)" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="status">Status *</Label>
                    <Select value={formData.status} onValueChange={(value: "Open" | "In Progress" | "Resolved" | "Rejected") => setFormData((prev) => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Resolved">Resolved</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} placeholder="Optional description or notes" rows={4} />
                  </div>

                  <div className="flex gap-4">
                    <Button type="submit" disabled={submitting}>
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Updating...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Update Ticket
                        </>
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => router.push(`/ticket?id=${ticketId}&mode=view`)} className="cursor-pointer">
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Ticket Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Department</Label>
                  <p className="text-sm">{selectedDepartment?.name || "Not selected"}</p>
                </div>

                {formData.subCategory && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Sub-Category</Label>
                    <p className="text-sm">{formData.subCategory}</p>
                  </div>
                )}

                {selectedDepartment && formData.ticketType && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Ticket Type</Label>
                    <p className="text-sm">{selectedDepartment.ticketTypes.find((t) => t.id === formData.ticketType)?.name || "Not selected"}</p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium text-gray-600">Client</Label>
                  <p className="text-sm">{formData.clientName || "Not entered"}</p>
                </div>

                {formData.unitId && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Unit ID</Label>
                    <p className="text-sm">{formData.unitId}</p>
                  </div>
                )}

                {selectedDepartment && formData.ticketType && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">SLA</Label>
                    <p className="text-sm">
                      {(() => {
                        const ticketType = selectedDepartment.ticketTypes.find((t) => t.id === formData.ticketType);
                        if (ticketType) {
                          // Calculate SLA from workflow if available, otherwise use defaultWD
                          const sla = { value: ticketType.defaultWD, unit: "days" as const };
                          return <SLADisplay sla={sla} />;
                        }
                        return "N/A";
                      })()}
                    </p>
                  </div>
                )}

                {selectedDepartment && formData.ticketType && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Default WD</Label>
                    <SLADisplay sla={{ value: selectedDepartment.ticketTypes.find((t) => t.id === formData.ticketType)?.defaultWD || 5, unit: "days" as const }} />
                  </div>
                )}

                {selectedDepartment && formData.ticketType && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Priority</Label>
                    <p className="text-sm">{selectedDepartment.ticketTypes.find((t) => t.id === formData.ticketType)?.priority}</p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium text-gray-600">Status</Label>
                  <p className="text-sm">{formData.status}</p>
                </div>

                {estimatedDueDate && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Updated Due Date</Label>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <p className="text-sm font-medium" suppressHydrationWarning>
                        {formatDate(estimatedDueDate)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // View mode
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="outline" size="sm" className="cursor-pointer">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Ticket {ticket.id.slice(-8)}</h1>
            <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
            {overdue && (
              <Badge variant="destructive">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Overdue
              </Badge>
            )}
          </div>
          <p className="text-gray-600" suppressHydrationWarning>
            Created on {formatDateTime(ticket.createdAt)}
          </p>
        </div>
        <Button onClick={() => router.push(`/ticket?id=${ticketId}&mode=edit`)} className="cursor-pointer">
          <Edit className="w-4 h-4 mr-2" />
          Edit Ticket
        </Button>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Information */}
            <Card>
              <CardHeader>
                <CardTitle>Ticket Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Building className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Department</p>
                      <p className="font-medium">{ticket.department}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Ticket Type</p>
                      <p className="font-medium">{ticket.ticketType}</p>
                    </div>
                  </div>

                  {ticket.subCategory && (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Sub-Category</p>
                        <p className="font-medium">{ticket.subCategory}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <UserIcon className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Client</p>
                      <p className="font-medium">{ticket.clientName}</p>
                    </div>
                  </div>

                  {ticket.unitId && (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Unit ID</p>
                        <p className="font-medium">{ticket.unitId}</p>
                      </div>
                    </div>
                  )}

                  {ticket.sla && (
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-600">Default WD</p>
                        <SLADisplay sla={ticket.sla} />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">SLA</p>
                      <p className="font-medium">
                        <SLADisplay sla={ticket.sla} />
                      </p>
                    </div>
                  </div>
                </div>

                {ticket.description && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Description</p>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status and Priority */}
            <Card>
              <CardHeader>
                <CardTitle>Status & Priority</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Priority</p>
                    <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Status</p>
                    <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Ticket Created</p>
                    <p className="text-xs text-gray-600" suppressHydrationWarning>
                      {formatDateTime(ticket.createdAt)}
                    </p>
                  </div>
                </div>

                {ticket.updatedAt.getTime() !== ticket.createdAt.getTime() && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">Last Updated</p>
                      <p className="text-xs text-gray-600" suppressHydrationWarning>
                        {formatDateTime(ticket.updatedAt)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Due Date */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Due Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className={`text-2xl font-bold mb-2 ${overdue ? "text-red-600" : "text-gray-900"}`} suppressHydrationWarning>
                    {formatDateTime(ticket.dueDate)}
                  </div>
                  {overdue ? (
                    <Badge variant="destructive">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {Math.abs(daysUntilDue)} days overdue
                    </Badge>
                  ) : daysUntilDue === 0 ? (
                    <Badge variant="secondary">Due today</Badge>
                  ) : daysUntilDue === 1 ? (
                    <Badge variant="secondary">Due tomorrow</Badge>
                  ) : (
                    <Badge variant="secondary">{daysUntilDue} days remaining</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full cursor-pointer" onClick={() => router.push(`/ticket?id=${ticketId}&mode=edit`)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Ticket
                </Button>

                {ticket.status === "Open" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      try {
                        await storage.updateTicket(ticket.id, { status: "In Progress" });
                        await loadData();
                      } catch (error) {
                        console.error("Error updating status:", error);
                      }
                    }}
                  >
                    Mark In Progress
                  </Button>
                )}

                {ticket.status === "In Progress" && (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={async () => {
                        try {
                          await storage.updateTicket(ticket.id, { status: "Resolved" });
                          showToast("Ticket marked as resolved!", "success");
                          await loadData();
                        } catch (error) {
                          console.error("Error updating status:", error);
                          showToast("Error updating ticket status", "error");
                        }
                      }}
                    >
                      Mark Resolved
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={async () => {
                        try {
                          await storage.updateTicket(ticket.id, { status: "Rejected" });
                          showToast("Ticket marked as rejected!", "success");
                          await loadData();
                        } catch (error) {
                          console.error("Error updating status:", error);
                          showToast("Error updating ticket status", "error");
                        }
                      }}
                    >
                      Mark Rejected
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Ticket History */}
      <TicketHistoryComponent ticketId={ticketId} />

      {/* Toast Container */}
      <ClientToastContainer />
    </div>
  );
}

export default function TicketPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <TicketPageContent />
    </Suspense>
  );
}
