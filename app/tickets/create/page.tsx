"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { storage, Department, Ticket } from "@/lib/storage";
import { calculateDueDate, formatDate } from "@/lib/utils/date-calculator";
import { ArrowLeft, Save, Calendar } from "lucide-react";
import Link from "next/link";

export default function CreateTicketPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    department: "",
    ticketType: "",
    clientName: "",
    workingDays: 5,
    priority: "Medium" as "Low" | "Medium" | "High" | "Critical",
    description: "",
  });

  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [estimatedDueDate, setEstimatedDueDate] = useState<Date | null>(null);

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    // Calculate due date when working days change
    if (formData.workingDays > 0) {
      const dueDate = calculateDueDate(new Date(), formData.workingDays);
      setEstimatedDueDate(dueDate);
    }
  }, [formData.workingDays]);

  useEffect(() => {
    // Update working days when ticket type changes
    if (selectedDepartment && formData.ticketType) {
      const ticketType = selectedDepartment.ticketTypes.find((t) => t.id === formData.ticketType);
      if (ticketType) {
        setFormData((prev) => ({ ...prev, workingDays: ticketType.defaultWD }));
      }
    }
  }, [formData.ticketType, selectedDepartment]);

  const loadDepartments = async () => {
    try {
      await storage.init();

      // Check if we need to seed data
      const existingDepartments = await storage.getDepartments();
      if (existingDepartments.length === 0) {
        console.log("Seeding database with departments...");
        const departmentsData = await import("@/data/departments.json");
        await storage.seedDepartments(departmentsData.default);
      }

      const depts = await storage.getDepartments();
      setDepartments(depts);
    } catch (error) {
      console.error("Error loading departments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentChange = (departmentId: string) => {
    const department = departments.find((d) => d.id === departmentId);
    setSelectedDepartment(department || null);
    setFormData((prev) => ({
      ...prev,
      department: departmentId,
      ticketType: "", // Reset ticket type when department changes
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDepartment || !formData.ticketType || !formData.clientName.trim()) {
      return;
    }

    try {
      setSubmitting(true);

      const ticketType = selectedDepartment.ticketTypes.find((t) => t.id === formData.ticketType);
      if (!ticketType) return;

      const newTicket: Omit<Ticket, "id" | "createdAt" | "updatedAt" | "dueDate"> = {
        department: selectedDepartment.name,
        ticketType: ticketType.name,
        clientName: formData.clientName.trim(),
        workingDays: formData.workingDays,
        priority: formData.priority,
        status: "Open",
        description: formData.description.trim() || undefined,
      };

      const createdTicket = await storage.createTicket(newTicket);

      // Redirect to main dashboard
      router.push("/");
    } catch (error) {
      console.error("Error creating ticket:", error);
      alert("Error creating ticket. Please try again.");
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

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create New Ticket</h1>
          <p className="text-gray-600">Fill in the details to create a new ticket</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Details</CardTitle>
              <CardDescription>Enter the information for the new ticket</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="department">Department *</Label>
                    <Select value={formData.department} onValueChange={handleDepartmentChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="ticketType">Ticket Type *</Label>
                    <Select value={formData.ticketType} onValueChange={(value) => setFormData((prev) => ({ ...prev, ticketType: value }))} disabled={!selectedDepartment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select ticket type" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedDepartment?.ticketTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name} ({type.defaultWD} WD)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="clientName">Client Name *</Label>
                  <Input id="clientName" value={formData.clientName} onChange={(e) => setFormData((prev) => ({ ...prev, clientName: e.target.value }))} placeholder="Enter client name" required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="workingDays">Working Days (WD) *</Label>
                    <Input id="workingDays" type="number" min="1" value={formData.workingDays} onChange={(e) => setFormData((prev) => ({ ...prev, workingDays: parseInt(e.target.value) || 1 }))} required />
                    <p className="text-sm text-gray-600 mt-1">Auto-filled from ticket type, but can be modified</p>
                  </div>

                  <div>
                    <Label htmlFor="priority">Priority *</Label>
                    <Select value={formData.priority} onValueChange={(value: "Low" | "Medium" | "High" | "Critical") => setFormData((prev) => ({ ...prev, priority: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} placeholder="Optional description or notes" rows={4} />
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Create Ticket
                      </>
                    )}
                  </Button>
                  <Link href="/">
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
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

              <div>
                <Label className="text-sm font-medium text-gray-600">Ticket Type</Label>
                <p className="text-sm">{selectedDepartment?.ticketTypes.find((t) => t.id === formData.ticketType)?.name || "Not selected"}</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-600">Client</Label>
                <p className="text-sm">{formData.clientName || "Not entered"}</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-600">Working Days</Label>
                <p className="text-sm">{formData.workingDays} WD</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-600">Priority</Label>
                <p className="text-sm">{formData.priority}</p>
              </div>

              {estimatedDueDate && (
                <div>
                  <Label className="text-sm font-medium text-gray-600">Estimated Due Date</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <p className="text-sm font-medium">{formatDate(estimatedDueDate)}</p>
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
