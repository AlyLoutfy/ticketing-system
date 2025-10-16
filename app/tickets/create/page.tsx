"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { storage, Department } from "@/lib/storage";
import { formatDate, getPriorityColor } from "@/lib/utils/date-calculator";
import { calculateDueDate as calculateSLADueDate } from "@/lib/utils/sla-formatter";
import { ArrowLeft, Save, Calendar, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CreateTicketPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
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
  });

  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [estimatedDueDate, setEstimatedDueDate] = useState<Date | null>(null);

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

      const depts = await storage.getDepartments();
      setDepartments(depts);
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
        // Use defaultWD to create SLA object
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

  const handleDepartmentChange = (departmentId: string) => {
    const department = departments.find((d) => d.id === departmentId);
    setSelectedDepartment(department || null);
    setFormData((prev) => ({
      ...prev,
      department: departmentId,
      subCategory: "",
      ticketType: "",
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

      const now = new Date();
      const newTicket = {
        department: selectedDepartment?.name || "",
        subCategory: formData.subCategory,
        ticketType: ticketType.name,
        clientName: formData.clientName,
        unitId: formData.unitId,
        workingDays: ticketType.defaultWD,
        ticketOwner: formData.ticketOwner,
        description: formData.description,
        status: "Open" as const,
        priority: ticketType.priority,
        sla: { value: ticketType.defaultWD, unit: "days" as const },
        createdAt: now,
        dueDate:
          estimatedDueDate ||
          (() => {
            const sla = { value: ticketType.defaultWD, unit: "days" as const };
            return calculateSLADueDate(sla, now);
          })(),
      };

      await storage.createTicket(newTicket);
      router.push("/");
    } catch (error) {
      console.error("Error creating ticket:", error);
      alert("Failed to create ticket. Please try again.");
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="outline" size="sm" className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900">Create New Ticket</h1>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="xl:col-span-2">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg p-4">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Ticket className="w-6 h-6" />
                  Ticket Information
                </CardTitle>
                <CardDescription className="text-blue-100">Provide the necessary details for the ticket</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
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
                              (() => {
                                const subCategories = [...new Set(selectedDepartment.ticketTypes.map((type) => type.subCategory || "General"))];
                                return subCategories.map((subCategory) => (
                                  <SelectItem key={subCategory} value={subCategory}>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                                      {subCategory}
                                    </div>
                                  </SelectItem>
                                ));
                              })()}
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
                              .filter((type) => (type.subCategory || "General") === formData.subCategory)
                              .map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  <div className="flex items-center justify-between w-full">
                                    <span>{type.name}</span>
                                    <Badge variant="secondary" className="ml-2 text-xs">
                                      {type.defaultWD} WD
                                    </Badge>
                                  </div>
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
                      <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                        Description <span className="text-gray-400 text-xs">(Optional)</span>
                      </Label>
                      <Textarea id="description" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} placeholder="Add any additional notes or context for this ticket..." rows={4} className="border-2 border-gray-200 focus:border-blue-500 transition-colors resize-none" />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-6 border-t border-gray-200">
                    <Button type="submit" disabled={submitting} className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer">
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
            <div className="sticky top-6">
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg p-4">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Ticket Preview
                  </CardTitle>
                  <CardDescription className="text-green-100">Review your ticket details</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
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

                  {/* Ticket Properties */}
                  {selectedDepartment?.ticketTypes.find((t) => t.id === formData.ticketType) && (
                    <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Ticket Properties</h4>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Working Days</span>
                        <Badge variant="secondary" className="text-xs">
                          {selectedDepartment.ticketTypes.find((t) => t.id === formData.ticketType)?.defaultWD} WD
                        </Badge>
                      </div>

                      {selectedDepartment.ticketTypes.find((t) => t.id === formData.ticketType)?.priority && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Priority</span>
                          <Badge className="text-xs" style={{ backgroundColor: getPriorityColor(selectedDepartment.ticketTypes.find((t) => t.id === formData.ticketType)?.priority || "").split(" ")[0], color: getPriorityColor(selectedDepartment.ticketTypes.find((t) => t.id === formData.ticketType)?.priority || "").split(" ")[1] }}>
                            {selectedDepartment.ticketTypes.find((t) => t.id === formData.ticketType)?.priority}
                          </Badge>
                        </div>
                      )}
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
  );
}
