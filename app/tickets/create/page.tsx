"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { storage, Department, Workflow } from "@/lib/storage";
import { formatDate } from "@/lib/utils/date-calculator";
import { calculateDueDate as calculateSLADueDate } from "@/lib/utils/sla-formatter";
import { Save, Calendar, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClientToastContainer, showToast } from "@/components/ui/client-toast";

export default function CreateTicketPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [formData, setFormData] = useState({
    department: "",
    subCategory: "",
    ticketType: "",
    clientName: "",
    unitId: "",
    ticketOwner: "",
    description: "",
    assignee: "",
  });

  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [estimatedDueDate, setEstimatedDueDate] = useState<Date | null>(null);
  const [departmentUsers, setDepartmentUsers] = useState<string[]>([]);

  const loadDepartments = async () => {
    try {
      await storage.init();

      // Check if we need to seed data
      const existingDepartments = await storage.getDepartments();
      if (existingDepartments.length === 0) {
        const departmentsData = await import("@/data/departments.json");
        await storage.seedDepartments(departmentsData.default);
        await storage.seedSampleTickets();
      }

      // Load both departments and workflows
      const [depts, workflowsData] = await Promise.all([storage.getDepartments(), storage.getWorkflows()]);
      setDepartments(depts);
      setWorkflows(workflowsData);
    } catch (error) {
      console.error("Error loading departments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    loadDepartments();
  }, []);

  useEffect(() => {
    // Calculate due date when ticket type changes
    if (selectedDepartment && formData.ticketType && mounted) {
      const ticketType = selectedDepartment.ticketTypes.find((t) => t.id === formData.ticketType);
      if (ticketType) {
        // Get the workflow for this ticket type, or fall back to default workflow
        const assignedWorkflow = ticketType.workflowId ? workflows.find((w) => w.id === ticketType.workflowId) : null;
        const defaultWorkflow = workflows.find((w) => w.isDefault);
        const selectedWorkflow = assignedWorkflow || defaultWorkflow;

        // Calculate SLA from workflow if available, otherwise use ticket type defaultWD
        let slaValue = ticketType.defaultWD;
        if (selectedWorkflow) {
          slaValue = selectedWorkflow.steps.reduce((total, step) => total + (step.estimatedDays || 1), 0);
        }

        const sla = { value: slaValue, unit: "days" as const };
        const dueDate = calculateSLADueDate(sla, new Date());
        setEstimatedDueDate(dueDate);
      }
    }
  }, [formData.ticketType, selectedDepartment, mounted, workflows]);

  useEffect(() => {
    const loadUsers = async () => {
      if (selectedDepartment?.name) {
        try {
          await storage.init();
          const users = await storage.getUsersByDepartment(selectedDepartment.name);
          setDepartmentUsers(users.map((u) => u.name));
        } catch (error) {
          console.error("Error loading department users:", error);
          setDepartmentUsers([]);
        }
      } else {
        setDepartmentUsers([]);
      }
    };
    loadUsers();
  }, [selectedDepartment]);

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

  const handleDepartmentChange = (departmentId: string) => {
    const department = departments.find((d) => d.id === departmentId);
    setSelectedDepartment(department || null);
    setFormData((prev) => ({
      ...prev,
      department: departmentId,
      subCategory: "",
      ticketType: "",
      assignee: "",
    }));
  };

  const handleSubCategoryChange = (subCategory: string) => {
    setFormData((prev) => ({
      ...prev,
      subCategory,
      ticketType: "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const ticketType = selectedDepartment?.ticketTypes.find((t) => t.id === formData.ticketType);
      if (!ticketType) {
        alert("Please select a valid ticket type");
        return;
      }

      // Get the workflow for this ticket type, or fall back to default workflow
      const assignedWorkflow = ticketType.workflowId ? workflows.find((w) => w.id === ticketType.workflowId) : null;
      const defaultWorkflow = workflows.find((w) => w.isDefault);
      const selectedWorkflow = assignedWorkflow || defaultWorkflow;

      // Calculate SLA from workflow if available, otherwise use ticket type defaultWD
      let slaValue = ticketType.defaultWD;
      if (selectedWorkflow) {
        slaValue = selectedWorkflow.steps.reduce((total, step) => total + (step.estimatedDays || 1), 0);
      }

      const now = new Date();
      const newTicket = {
        department: selectedDepartment?.name || "",
        subCategory: formData.subCategory,
        ticketType: ticketType.name,
        clientName: formData.clientName,
        unitId: formData.unitId,
        workingDays: slaValue, // Use calculated SLA value
        ticketOwner: formData.ticketOwner,
        assignee: formData.assignee,
        description: formData.description,
        status: "Open" as const,
        priority: ticketType.priority,
        sla: { value: slaValue, unit: "days" as const }, // Use calculated SLA value
        currentDepartment: selectedDepartment?.name,
        currentWorkflowStep: 1,
        isFullyResolved: false,
        workflowId: selectedWorkflow?.id, // Assign the workflow from ticket type or default
        createdAt: now,
        dueDate:
          estimatedDueDate ||
          (() => {
            const sla = { value: slaValue, unit: "days" as const };
            return calculateSLADueDate(sla, now);
          })(),
      };

      await storage.createTicket(newTicket);
      showToast("Success!", "success", "Ticket created successfully.");

      // Wait a moment for the toast to show, then redirect
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (error) {
      console.error("Error creating ticket:", error);
      showToast("Error", "error", "Failed to create ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New Ticket</h1>
            <p className="text-sm text-gray-500">Provide the necessary details for the ticket</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="xl:col-span-2">
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm p-0">
                <CardHeader className="bg-blue-100 border border-blue-300 text-blue-900 rounded-t-lg p-4 m-0">
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Ticket className="w-6 h-6" />
                    Ticket Information
                  </CardTitle>
                  <CardDescription className="text-blue-800">Provide the necessary details for the ticket</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Step 1: Department & Sub-Category Selection */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                        <h3 className="text-lg font-semibold text-gray-900">Department & Category</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label htmlFor="department" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            Department <span className="text-red-500">*</span>
                          </Label>
                          <Select value={formData.department} onValueChange={handleDepartmentChange}>
                            <SelectTrigger className="h-12 border-2 border-gray-200 focus:border-blue-500 transition-colors">
                              <SelectValue placeholder="Choose a department" />
                            </SelectTrigger>
                            <SelectContent>
                              {departments.map((dept) => (
                                <SelectItem key={dept.id} value={dept.id}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    {dept.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3">
                          <Label htmlFor="subCategory" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            Sub-Category <span className="text-red-500">*</span>
                          </Label>
                          <Select value={formData.subCategory} onValueChange={handleSubCategoryChange} disabled={!selectedDepartment}>
                            <SelectTrigger className="h-12 border-2 border-gray-200 focus:border-blue-500 transition-colors disabled:bg-gray-50">
                              <SelectValue placeholder="Choose sub-category" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedDepartment &&
                                (selectedDepartment.subCategories || []).map((subCategory) => (
                                  <SelectItem key={subCategory} value={subCategory}>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                                      {subCategory}
                                    </div>
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Ticket Type Selection */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                        <h3 className="text-lg font-semibold text-gray-900">Ticket Type</h3>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="ticketType" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                          Ticket Type <span className="text-red-500">*</span>
                        </Label>
                        <Select value={formData.ticketType} onValueChange={(value) => setFormData((prev) => ({ ...prev, ticketType: value }))} disabled={!formData.subCategory}>
                          <SelectTrigger className="h-12 border-2 border-gray-200 focus:border-blue-500 transition-colors disabled:bg-gray-50">
                            <SelectValue placeholder="Select ticket type" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedDepartment &&
                              formData.subCategory &&
                              selectedDepartment.ticketTypes
                                .filter((type) => type.subCategory === formData.subCategory)
                                .map((type) => (
                                  <SelectItem key={type.id} value={type.id}>
                                    {type.name}
                                  </SelectItem>
                                ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Step 3: Client Information */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                        <h3 className="text-lg font-semibold text-gray-900">Client Information</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label htmlFor="clientName" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            Client Name <span className="text-red-500">*</span>
                          </Label>
                          <Input id="clientName" value={formData.clientName} onChange={(e) => setFormData((prev) => ({ ...prev, clientName: e.target.value }))} placeholder="Enter client name" required className="h-12 border-2 border-gray-200 focus:border-blue-500 transition-colors" />
                        </div>
                        <div className="space-y-3">
                          <Label htmlFor="unitId" className="text-sm font-medium text-gray-700">
                            Unit ID <span className="text-gray-400 text-xs">(Optional)</span>
                          </Label>
                          <Input id="unitId" value={formData.unitId} onChange={(e) => setFormData((prev) => ({ ...prev, unitId: e.target.value }))} placeholder="Enter unit ID" className="h-12 border-2 border-gray-200 focus:border-blue-500 transition-colors" />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="ticketOwner" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                          Ticket Owner <span className="text-red-500">*</span>
                        </Label>
                        <Input id="ticketOwner" value={formData.ticketOwner} onChange={(e) => setFormData((prev) => ({ ...prev, ticketOwner: e.target.value }))} placeholder="Enter ticket owner name" required className="h-12 border-2 border-gray-200 focus:border-blue-500 transition-colors" />
                      </div>
                    </div>

                    {/* Step 4: Additional Details */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">4</div>
                        <h3 className="text-lg font-semibold text-gray-900">Additional Details</h3>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-gray-700">
                          Assign To <span className="text-red-500">*</span>
                        </Label>
                        <Select value={formData.assignee} onValueChange={(v) => setFormData((prev) => ({ ...prev, assignee: v }))} disabled={!selectedDepartment}>
                          <SelectTrigger className="h-12 border-2 border-gray-200 focus:border-blue-500 transition-colors disabled:bg-gray-50">
                            <SelectValue placeholder="Choose assignee" />
                          </SelectTrigger>
                          <SelectContent>
                            {departmentUsers.map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                          Description <span className="text-gray-400 text-xs">(Optional)</span>
                        </Label>
                        <Textarea id="description" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} placeholder="Add any additional notes or context for this ticket..." rows={4} className="border-2 border-gray-200 focus:border-blue-500 transition-colors resize-none" />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-6 border-t border-gray-200">
                      <Button type="submit" disabled={submitting} className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer">
                        {submitting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Creating Ticket...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Create Ticket
                          </>
                        )}
                      </Button>
                      <Link href="/">
                        <Button type="button" variant="outline" className="h-12 px-8 border-2 border-gray-300 hover:border-gray-400 transition-colors cursor-pointer">
                          Cancel
                        </Button>
                      </Link>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Preview Sidebar */}
            <div className="xl:col-span-1">
              <div className="sticky top-0">
                <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm p-0">
                  <CardHeader className="bg-green-100 border border-green-300 text-green-900 rounded-t-lg p-4 m-0">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Ticket Preview
                    </CardTitle>
                    <CardDescription className="text-green-800">Review your ticket details</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 pt-6 space-y-4">
                    {/* Department & Type */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-600">Department</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 pl-4">{selectedDepartment?.name || "Not selected"}</p>

                      {formData.subCategory && (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                            <span className="text-sm font-medium text-gray-600">Sub-Category</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 pl-4">{formData.subCategory}</p>
                        </>
                      )}

                      {selectedDepartment?.ticketTypes.find((t) => t.id === formData.ticketType) && (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            <span className="text-sm font-medium text-gray-600">Ticket Type</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 pl-4">{selectedDepartment.ticketTypes.find((t) => t.id === formData.ticketType)?.name}</p>
                        </>
                      )}
                    </div>

                    {/* Client Info */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-600">Client</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 pl-4">{formData.clientName || "Not entered"}</p>

                      {formData.unitId && (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm font-medium text-gray-600">Unit ID</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 pl-4">{formData.unitId}</p>
                        </>
                      )}

                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-600">Ticket Owner</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 pl-4">{formData.ticketOwner || "Not entered"}</p>
                    </div>

                    {/* Workflow Information */}
                    {selectedDepartment?.ticketTypes.find((t) => t.id === formData.ticketType) && (
                      <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="text-sm font-semibold text-blue-700 mb-3">Workflow Information</h4>

                        {(() => {
                          const ticketType = selectedDepartment.ticketTypes.find((t) => t.id === formData.ticketType);
                          if (!ticketType) return null;

                          // Get workflow information
                          const assignedWorkflow = ticketType.workflowId ? workflows.find((w) => w.id === ticketType.workflowId) : null;
                          const defaultWorkflow = workflows.find((w) => w.isDefault);
                          const selectedWorkflow = assignedWorkflow || defaultWorkflow;

                          if (!selectedWorkflow) {
                            return (
                              <div className="text-sm text-gray-600">
                                <span className="text-gray-500">No workflow assigned</span>
                              </div>
                            );
                          }

                          const totalSLA = selectedWorkflow.steps.reduce((total, step) => total + (step.estimatedDays || 1), 0);
                          const totalSteps = selectedWorkflow.steps.length;

                          return (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Workflow</span>
                                <span className="text-sm font-medium text-blue-800">{selectedWorkflow.name}</span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Total SLA</span>
                                <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                                  {totalSLA} WD
                                </Badge>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Milestones</span>
                                <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                                  {totalSteps} milestones
                                </Badge>
                              </div>

                              {assignedWorkflow ? <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">✓ Custom workflow assigned</div> : <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Using default workflow</div>}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Due Date */}
                    {estimatedDueDate && (
                      <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-700">Estimated Due Date</span>
                        </div>
                        <p className="text-sm font-semibold text-blue-900 pl-6" suppressHydrationWarning>
                          {formatDate(estimatedDueDate)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ClientToastContainer />
    </div>
  );
}
