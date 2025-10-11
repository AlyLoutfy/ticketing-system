"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { storage, Department, TicketType } from "@/lib/storage";
import { Plus, Settings, Users, Ticket, Edit, Trash2, Save, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeded, setIsSeeded] = useState(false);

  // Department CRUD states
  const [showDeptDialog, setShowDeptDialog] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptFormData, setDeptFormData] = useState({
    name: "",
    description: "",
  });

  // Expandable departments state
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  // Inline editing states
  const [editingTicketTypes, setEditingTicketTypes] = useState<{ [deptId: string]: TicketType[] }>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<{ [deptId: string]: boolean }>({});

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      await storage.init();
      const depts = await storage.getDepartments();
      setDepartments(depts);
      setIsSeeded(depts.length > 0);
    } catch (error) {
      console.error("Error loading departments:", error);
    } finally {
      setLoading(false);
    }
  };

  const seedData = async () => {
    try {
      setLoading(true);
      // Import the departments data
      const departmentsData = await import("@/data/departments.json");
      await storage.seedDepartments(departmentsData.default);
      // Also seed sample tickets
      await storage.seedSampleTickets();
      await loadDepartments();
    } catch (error) {
      console.error("Error seeding data:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalTicketTypes = departments.reduce((sum, dept) => sum + dept.ticketTypes.length, 0);

  // Department CRUD functions
  const handleCreateDepartment = async () => {
    if (!deptFormData.name.trim()) return;

    try {
      const newDept: Omit<Department, "id" | "createdAt" | "updatedAt"> = {
        name: deptFormData.name.trim(),
        ticketTypes: [],
      };

      await storage.createDepartment(newDept);
      await loadDepartments();
      setShowDeptDialog(false);
      setDeptFormData({ name: "", description: "" });
    } catch (error) {
      console.error("Error creating department:", error);
      alert("Error creating department. Please try again.");
    }
  };

  const handleUpdateDepartment = async () => {
    if (!editingDept || !deptFormData.name.trim()) return;

    try {
      const updates: Partial<Department> = {
        name: deptFormData.name.trim(),
      };

      await storage.updateDepartment(editingDept.id, updates);
      await loadDepartments();
      setShowDeptDialog(false);
      setEditingDept(null);
      setDeptFormData({ name: "", description: "" });
    } catch (error) {
      console.error("Error updating department:", error);
      alert("Error updating department. Please try again.");
    }
  };

  const handleDeleteDepartment = async (deptId: string) => {
    if (!confirm("Are you sure you want to delete this department? This will also delete all its ticket types.")) return;

    try {
      await storage.deleteDepartment(deptId);
      await loadDepartments();
    } catch (error) {
      console.error("Error deleting department:", error);
      alert("Error deleting department. Please try again.");
    }
  };

  // Expandable department functions
  const toggleDepartment = (deptId: string) => {
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(deptId)) {
      newExpanded.delete(deptId);
    } else {
      newExpanded.add(deptId);
    }
    setExpandedDepartments(newExpanded);
  };

  // Inline editing functions
  const startEditingDepartment = (dept: Department) => {
    setEditingTicketTypes((prev) => ({
      ...prev,
      [dept.id]: [...dept.ticketTypes],
    }));
    setHasUnsavedChanges((prev) => ({
      ...prev,
      [dept.id]: false,
    }));
  };

  const addNewTicketTypeRow = (deptId: string) => {
    const newTicketType: TicketType = {
      id: `temp-${Date.now()}`,
      name: "",
      defaultWD: 5,
      description: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setEditingTicketTypes((prev) => ({
      ...prev,
      [deptId]: [...(prev[deptId] || []), newTicketType],
    }));
    setHasUnsavedChanges((prev) => ({
      ...prev,
      [deptId]: true,
    }));
  };

  const updateTicketTypeInEdit = (deptId: string, index: number, field: keyof TicketType, value: string | number) => {
    setEditingTicketTypes((prev) => {
      const updated = [...(prev[deptId] || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, [deptId]: updated };
    });
    setHasUnsavedChanges((prev) => ({
      ...prev,
      [deptId]: true,
    }));
  };

  const removeTicketTypeFromEdit = (deptId: string, index: number) => {
    setEditingTicketTypes((prev) => {
      const updated = [...(prev[deptId] || [])];
      updated.splice(index, 1);
      return { ...prev, [deptId]: updated };
    });
    setHasUnsavedChanges((prev) => ({
      ...prev,
      [deptId]: true,
    }));
  };

  const saveDepartmentChanges = async (deptId: string) => {
    try {
      const department = departments.find((d) => d.id === deptId);
      if (!department) return;

      const editedTicketTypes = editingTicketTypes[deptId] || [];

      // Update the department with new ticket types
      const updatedDepartment: Department = {
        ...department,
        ticketTypes: editedTicketTypes.filter((tt) => tt.name.trim() !== ""), // Remove empty rows
        updatedAt: new Date(),
      };

      await storage.updateDepartment(deptId, { ticketTypes: updatedDepartment.ticketTypes });
      await loadDepartments();

      // Clear editing state
      setEditingTicketTypes((prev) => {
        const newState = { ...prev };
        delete newState[deptId];
        return newState;
      });
      setHasUnsavedChanges((prev) => ({
        ...prev,
        [deptId]: false,
      }));
    } catch (error) {
      console.error("Error saving department changes:", error);
      alert("Error saving changes. Please try again.");
    }
  };

  const cancelEditingDepartment = (deptId: string) => {
    setEditingTicketTypes((prev) => {
      const newState = { ...prev };
      delete newState[deptId];
      return newState;
    });
    setHasUnsavedChanges((prev) => ({
      ...prev,
      [deptId]: false,
    }));
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage departments and ticket types</p>
        </div>
        <div className="flex gap-2">
          <Link href="/">
            <Button variant="outline">
              <Ticket className="w-4 h-4 mr-2" />
              View Tickets
            </Button>
          </Link>
          <Link href="/tickets/create">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Ticket
            </Button>
          </Link>
        </div>
      </div>

      {!isSeeded && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800">Setup Required</CardTitle>
            <CardDescription className="text-amber-700">No departments found. Click below to seed the database with data from Excel files.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={seedData} className="bg-amber-600 hover:bg-amber-700">
              <Settings className="w-4 h-4 mr-2" />
              Seed Database
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Departments</p>
              <p className="text-lg font-bold">{departments.length}</p>
            </div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Ticket Types</p>
              <p className="text-lg font-bold">{totalTicketTypes}</p>
            </div>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">System Status</p>
              <p className="text-lg font-bold">
                <Badge variant="secondary" className="text-green-600 bg-green-100 text-xs">
                  Ready
                </Badge>
              </p>
            </div>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Departments Overview</CardTitle>
              <CardDescription>Manage departments and their ticket types</CardDescription>
            </div>
            <Dialog open={showDeptDialog} onOpenChange={setShowDeptDialog}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingDept(null);
                    setDeptFormData({ name: "", description: "" });
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Department
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingDept ? "Edit Department" : "Add New Department"}</DialogTitle>
                  <DialogDescription>{editingDept ? "Update the department information" : "Create a new department for organizing ticket types"}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="deptName">Department Name *</Label>
                    <Input id="deptName" value={deptFormData.name} onChange={(e) => setDeptFormData((prev) => ({ ...prev, name: e.target.value }))} placeholder="Enter department name" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDeptDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={editingDept ? handleUpdateDepartment : handleCreateDepartment}>
                    <Save className="w-4 h-4 mr-2" />
                    {editingDept ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No departments found</h3>
              <p className="text-gray-600 mb-4">Get started by seeding the database with your Excel data or creating a new department.</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={seedData}>
                  <Settings className="w-4 h-4 mr-2" />
                  Seed Database
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingDept(null);
                    setDeptFormData({ name: "", description: "" });
                    setShowDeptDialog(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Department
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {departments.map((department) => {
                const isExpanded = expandedDepartments.has(department.id);
                const isEditing = editingTicketTypes[department.id] !== undefined;
                const hasChanges = hasUnsavedChanges[department.id];
                const ticketTypes = isEditing ? editingTicketTypes[department.id] : department.ticketTypes;

                return (
                  <div key={department.id} className="border rounded-lg">
                    {/* Department Header */}
                    <div className="p-4 border-b bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Button variant="ghost" size="sm" onClick={() => toggleDepartment(department.id)} className="p-1">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </Button>
                          <div>
                            <h3 className="font-semibold text-lg">{department.name}</h3>
                            <p className="text-sm text-gray-600">{department.ticketTypes.length} ticket types</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => cancelEditingDepartment(department.id)}>
                                Cancel
                              </Button>
                              <Button size="sm" onClick={() => saveDepartmentChanges(department.id)} disabled={!hasChanges}>
                                <Save className="w-4 h-4 mr-2" />
                                Save Changes
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => handleDeleteDepartment(department.id)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Content */}
                    {isExpanded && (
                      <div className="p-4">
                        {isEditing ? (
                          <div className="space-y-4">
                            <h4 className="font-medium">Ticket Types</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left p-2 font-medium text-sm">Name</th>
                                    <th className="text-left p-2 font-medium text-sm">Default WD</th>
                                    <th className="text-left p-2 font-medium text-sm">Description</th>
                                    <th className="text-left p-2 font-medium text-sm w-20">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ticketTypes.map((type, index) => (
                                    <tr key={type.id} className="border-b">
                                      <td className="p-2">
                                        <Input value={type.name} onChange={(e) => updateTicketTypeInEdit(department.id, index, "name", e.target.value)} placeholder="Ticket type name" className="h-8" />
                                      </td>
                                      <td className="p-2">
                                        <Input type="number" min="1" value={type.defaultWD} onChange={(e) => updateTicketTypeInEdit(department.id, index, "defaultWD", parseInt(e.target.value) || 1)} className="h-8 w-20" />
                                      </td>
                                      <td className="p-2">
                                        <Input value={type.description || ""} onChange={(e) => updateTicketTypeInEdit(department.id, index, "description", e.target.value)} placeholder="Optional description" className="h-8" />
                                      </td>
                                      <td className="p-2">
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => removeTicketTypeFromEdit(department.id, index)}>
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div className="flex justify-center pt-2">
                                <Button variant="ghost" size="sm" onClick={() => addNewTicketTypeRow(department.id)} className="text-blue-600 hover:text-blue-700">
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">Ticket Types ({department.ticketTypes.length})</h4>
                              <Button variant="outline" size="sm" onClick={() => startEditingDepartment(department)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Ticket Types
                              </Button>
                            </div>
                            {department.ticketTypes.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                  <thead>
                                    <tr className="border-b">
                                      <th className="text-left p-2 font-medium text-sm">Name</th>
                                      <th className="text-left p-2 font-medium text-sm">Default WD</th>
                                      <th className="text-left p-2 font-medium text-sm">Description</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {department.ticketTypes.map((type) => (
                                      <tr key={type.id} className="border-b">
                                        <td className="p-2 text-sm">{type.name}</td>
                                        <td className="p-2 text-sm">{type.defaultWD}</td>
                                        <td className="p-2 text-sm text-gray-600">{type.description || "-"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 text-center py-4">No ticket types yet. Click &quot;Edit Ticket Types&quot; to add some.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
