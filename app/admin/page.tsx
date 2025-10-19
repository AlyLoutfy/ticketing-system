"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { storage, Department, TicketType, Workflow } from "@/lib/storage";
import { WorkflowSLADisplay } from "@/components/ui/workflow-sla-display";
import { WorkflowSelect } from "@/components/ui/workflow-select";
import { Plus, Settings, Users, Ticket, Edit, Trash2, Save, ChevronDown, ChevronRight, Workflow as WorkflowIcon, ArrowLeft, X, Check } from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeded, setIsSeeded] = useState(false);

  // Department CRUD states
  const [showDeptDialog, setShowDeptDialog] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptFormData, setDeptFormData] = useState({
    name: "",
    description: "",
    subCategories: [] as string[],
  });

  // Expandable departments state
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  // Inline editing states
  const [editingTicketTypes, setEditingTicketTypes] = useState<{ [deptId: string]: TicketType[] }>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<{ [deptId: string]: boolean }>({});

  // Sub-category management
  const [newSubCategory, setNewSubCategory] = useState("");
  const [editingSubCategory, setEditingSubCategory] = useState<{ index: number; value: string } | null>(null);

  const addSubCategory = () => {
    if (newSubCategory.trim() && !(deptFormData.subCategories || []).includes(newSubCategory.trim())) {
      setDeptFormData((prev) => ({
        ...prev,
        subCategories: [...(prev.subCategories || []), newSubCategory.trim()],
      }));
      setNewSubCategory("");
    }
  };

  const removeSubCategory = (subCategory: string) => {
    setDeptFormData((prev) => ({
      ...prev,
      subCategories: (prev.subCategories || []).filter((cat) => cat !== subCategory),
    }));
  };

  const startEditingSubCategory = (index: number, currentValue: string) => {
    setEditingSubCategory({ index, value: currentValue });
  };

  const saveSubCategoryEdit = () => {
    if (editingSubCategory && editingSubCategory.value.trim()) {
      const newValue = editingSubCategory.value.trim();
      const currentCategories = deptFormData.subCategories || [];

      // Check if the new value already exists (excluding the current one being edited)
      const isDuplicate = currentCategories.some((cat, idx) => cat === newValue && idx !== editingSubCategory.index);

      if (!isDuplicate) {
        setDeptFormData((prev) => ({
          ...prev,
          subCategories: (prev.subCategories || []).map((cat, idx) => (idx === editingSubCategory.index ? newValue : cat)),
        }));
      }
    }
    setEditingSubCategory(null);
  };

  const cancelSubCategoryEdit = () => {
    setEditingSubCategory(null);
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      await storage.init();
      const [depts, workflowsData] = await Promise.all([storage.getDepartments(), storage.getWorkflows()]);
      setDepartments(depts);
      setWorkflows(workflowsData);
      setIsSeeded(depts.length > 0);
    } catch (error) {
      console.error("Error loading data:", error);
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

  const getWorkflowName = (workflowId?: string) => {
    if (!workflowId) return "Default";
    const workflow = workflows.find((w) => w.id === workflowId);
    return workflow ? workflow.name : "Unknown";
  };

  // Department CRUD functions
  const handleCreateDepartment = async () => {
    if (!deptFormData.name.trim()) return;

    try {
      const newDept: Omit<Department, "id" | "createdAt" | "updatedAt"> = {
        name: deptFormData.name.trim(),
        ticketTypes: [],
        subCategories: deptFormData.subCategories,
      };

      await storage.createDepartment(newDept);
      await loadDepartments();
      setShowDeptDialog(false);
      setDeptFormData({ name: "", description: "", subCategories: [] });
      setNewSubCategory("");
      setEditingSubCategory(null);
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
        subCategories: deptFormData.subCategories,
      };

      await storage.updateDepartment(editingDept.id, updates);
      await loadDepartments();
      setShowDeptDialog(false);
      setEditingDept(null);
      setDeptFormData({ name: "", description: "", subCategories: [] });
      setNewSubCategory("");
      setEditingSubCategory(null);
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
    const now = new Date();
    const newTicketType: TicketType = {
      id: `temp-${now.getTime()}`,
      name: "",
      defaultWD: 5,
      description: "",
      subCategory: "",
      priority: "Medium",
      createdAt: now,
      updatedAt: now,
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

  const updateTicketTypeInEdit = (deptId: string, index: number, field: keyof TicketType, value: string | number | { value: number; unit: "hours" | "days" }) => {
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

  const handleWorkflowClick = (workflowId?: string) => {
    if (workflowId) {
      // Navigate to workflows page with the specific workflow to edit
      window.location.href = `/admin/workflows?edit=${workflowId}`;
    }
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
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm" className="cursor-pointer">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tickets
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage departments and ticket types</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/workflows">
            <Button variant="outline" className="cursor-pointer">
              <WorkflowIcon className="w-4 h-4 mr-2" />
              Manage Workflows
            </Button>
          </Link>
          <Link href="/tickets/create">
            <Button className="cursor-pointer">
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
              <p className="text-xs text-muted-foreground">Workflows</p>
              <p className="text-lg font-bold">{workflows.length}</p>
            </div>
            <WorkflowIcon className="h-4 w-4 text-muted-foreground" />
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
                    setDeptFormData({ name: "", description: "", subCategories: [] });
                    setNewSubCategory("");
                    setEditingSubCategory(null);
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
                  <div className="space-y-3">
                    <Label htmlFor="deptName">Department Name *</Label>
                    <Input id="deptName" value={deptFormData.name} onChange={(e) => setDeptFormData((prev) => ({ ...prev, name: e.target.value }))} placeholder="Enter department name" />
                  </div>

                  <div className="space-y-3">
                    <Label>Sub-Categories</Label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input value={newSubCategory} onChange={(e) => setNewSubCategory(e.target.value)} placeholder="Add sub-category" onKeyPress={(e) => e.key === "Enter" && addSubCategory()} />
                        <Button type="button" onClick={addSubCategory} size="sm">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      {(deptFormData.subCategories || []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {(deptFormData.subCategories || []).map((subCat, index) => (
                            <div key={index} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-sm">
                              {editingSubCategory?.index === index ? (
                                <>
                                  <Input
                                    value={editingSubCategory.value}
                                    onChange={(e) => setEditingSubCategory({ index, value: e.target.value })}
                                    onKeyPress={(e) => {
                                      if (e.key === "Enter") saveSubCategoryEdit();
                                      if (e.key === "Escape") cancelSubCategoryEdit();
                                    }}
                                    className="h-6 text-xs px-1 py-0"
                                    autoFocus
                                  />
                                  <button type="button" onClick={saveSubCategoryEdit} className="text-green-600 hover:text-green-700" title="Save">
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button type="button" onClick={cancelSubCategoryEdit} className="text-gray-500 hover:text-gray-700" title="Cancel">
                                    <X className="w-3 h-3" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span>{subCat}</span>
                                  <button type="button" onClick={() => startEditingSubCategory(index, subCat)} className="text-blue-500 hover:text-blue-700" title="Edit">
                                    <Edit className="w-3 h-3" />
                                  </button>
                                  <button type="button" onClick={() => removeSubCategory(subCat)} className="text-red-500 hover:text-red-700" title="Remove">
                                    <X className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeptDialog(false);
                      setEditingSubCategory(null);
                    }}
                  >
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
                    setDeptFormData({ name: "", description: "", subCategories: [] });
                    setNewSubCategory("");
                    setEditingSubCategory(null);
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
                        <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => toggleDepartment(department.id)}>
                          <div className="p-1">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</div>
                          <div>
                            <h3 className="font-semibold text-lg">{department.name}</h3>
                            <p className="text-sm text-gray-600">{department.ticketTypes.length} ticket types</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => cancelEditingDepartment(department.id)} className="cursor-pointer">
                                Cancel
                              </Button>
                              <Button size="sm" onClick={() => saveDepartmentChanges(department.id)} disabled={!hasChanges} className="cursor-pointer">
                                <Save className="w-4 h-4 mr-2" />
                                Save Changes
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingDept(department);
                                  setDeptFormData({
                                    name: department.name,
                                    description: "",
                                    subCategories: department.subCategories || [],
                                  });
                                  setNewSubCategory("");
                                  setEditingSubCategory(null);
                                  setShowDeptDialog(true);
                                }}
                                className="cursor-pointer"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDeleteDepartment(department.id)} className="cursor-pointer">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Content */}
                    {isExpanded && (
                      <div className="p-4">
                        {isEditing ? (
                          <div className="space-y-4">
                            <h4 className="text-lg font-semibold text-gray-900">Ticket Types</h4>

                            <div className="bg-white border border-gray-300 overflow-hidden">
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                  <thead>
                                    <tr className="bg-gray-100">
                                      <th className="border-r border-gray-300 px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-48">Name</th>
                                      <th className="border-r border-gray-300 px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-32">Sub-Category</th>
                                      <th className="border-r border-gray-300 px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-32">SLA (Calculated)</th>
                                      <th className="border-r border-gray-300 px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-24">Priority</th>
                                      <th className="border-r border-gray-300 px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-32">Workflow</th>
                                      <th className="border-r border-gray-300 px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-48">Description</th>
                                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-20">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ticketTypes.map((type, index) => (
                                      <tr key={type.id} className="hover:bg-blue-50 transition-colors">
                                        <td className="border-r border-gray-300 p-0">
                                          <Input value={type.name} onChange={(e) => updateTicketTypeInEdit(department.id, index, "name", e.target.value)} placeholder="Ticket type name" className="h-8 w-full border-0 bg-transparent px-3 py-2 text-sm focus:ring-0 focus:outline-none focus:bg-blue-100 rounded-none" />
                                        </td>
                                        <td className="border-r border-gray-300 p-0">
                                          <Select value={type.subCategory || "General"} onValueChange={(value) => updateTicketTypeInEdit(department.id, index, "subCategory", value)}>
                                            <SelectTrigger className="h-8 w-full border-0 bg-transparent px-3 py-2 text-sm focus:ring-0 focus:outline-none focus:bg-blue-100 shadow-none rounded-none">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {(department.subCategories || []).map((category) => (
                                                <SelectItem key={category} value={category}>
                                                  {category}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </td>
                                        <td className="border-r border-gray-300 p-0">
                                          <div className="px-3 py-2 text-sm text-gray-600 h-8 flex items-center">
                                            <WorkflowSLADisplay workflowId={type.workflowId} workflows={workflows} />
                                          </div>
                                        </td>
                                        <td className="border-r border-gray-300 p-0">
                                          <Select value={type.priority || "Medium"} onValueChange={(value) => updateTicketTypeInEdit(department.id, index, "priority", value)}>
                                            <SelectTrigger className="h-8 w-full border-0 bg-transparent px-3 py-2 text-sm focus:ring-0 focus:outline-none focus:bg-blue-100 shadow-none rounded-none">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="Low" className="bg-green-50 text-green-700 hover:bg-green-100 w-full">
                                                Low
                                              </SelectItem>
                                              <SelectItem value="Medium" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 w-full">
                                                Medium
                                              </SelectItem>
                                              <SelectItem value="High" className="bg-orange-50 text-orange-700 hover:bg-orange-100 w-full">
                                                High
                                              </SelectItem>
                                              <SelectItem value="Critical" className="bg-red-50 text-red-700 hover:bg-red-100 w-full">
                                                Critical
                                              </SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </td>
                                        <td className="border-r border-gray-300 p-0">
                                          <WorkflowSelect value={type.workflowId || "none"} onValueChange={(value) => updateTicketTypeInEdit(department.id, index, "workflowId", value === "none" ? "" : value)} workflows={workflows} className="h-8 w-full border-0 bg-transparent px-3 py-2 text-sm focus:ring-0 focus:outline-none focus:bg-blue-100 shadow-none rounded-none" />
                                        </td>
                                        <td className="border-r border-gray-300 p-0">
                                          <Input value={type.description || ""} onChange={(e) => updateTicketTypeInEdit(department.id, index, "description", e.target.value)} placeholder="Optional description" className="h-8 w-full border-0 bg-transparent px-3 py-2 text-sm focus:ring-0 focus:outline-none focus:bg-blue-100 rounded-none" />
                                        </td>
                                        <td className="p-0 text-center">
                                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-none" onClick={() => removeTicketTypeFromEdit(department.id, index)}>
                                            <Trash2 className="w-3 h-3" />
                                          </Button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {ticketTypes.length === 0 && (
                                <div className="text-center py-12">
                                  <div className="text-gray-400 mb-4">
                                    <Plus className="w-12 h-12 mx-auto" />
                                  </div>
                                  <p className="text-gray-600 font-medium">No ticket types yet</p>
                                  <p className="text-sm text-gray-500">Click &quot;Add Ticket Type&quot; to create your first one</p>
                                </div>
                              )}
                            </div>

                            <div className="flex justify-center">
                              <Button variant="outline" size="sm" onClick={() => addNewTicketTypeRow(department.id)} className="text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Ticket Type
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-lg font-semibold text-gray-900">Ticket Types ({department.ticketTypes.length})</h4>
                              <Button variant="outline" size="sm" onClick={() => startEditingDepartment(department)} className="text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer">
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Ticket Types
                              </Button>
                            </div>

                            {department.ticketTypes.length > 0 ? (
                              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                      <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-48">Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Sub-Category</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">SLA</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">Priority</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Workflow</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-48">Description</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {department.ticketTypes.map((type) => (
                                        <tr key={type.id} className="hover:bg-gray-50 transition-colors">
                                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{type.name}</td>
                                          <td className="px-4 py-3 text-sm text-gray-600">{type.subCategory || "-"}</td>
                                          <td className="px-4 py-3 text-sm text-gray-900">
                                            <WorkflowSLADisplay workflowId={type.workflowId} workflows={workflows} />
                                          </td>
                                          <td className="px-4 py-3">
                                            <Badge variant={type.priority === "Critical" ? "destructive" : type.priority === "High" ? "default" : "secondary"}>{type.priority || "Medium"}</Badge>
                                          </td>
                                          <td className="px-4 py-3 text-sm">
                                            <button onClick={() => handleWorkflowClick(type.workflowId)} className={`font-medium transition-colors cursor-pointer ${type.workflowId ? "text-blue-600 hover:text-blue-800 hover:underline" : "text-gray-600"}`}>
                                              {getWorkflowName(type.workflowId)}
                                            </button>
                                          </td>
                                          <td className="px-4 py-3 text-sm text-gray-600">{type.description || "-"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                                <div className="text-center py-12">
                                  <div className="text-gray-400 mb-4">
                                    <Edit className="w-12 h-12 mx-auto" />
                                  </div>
                                  <p className="text-gray-600 font-medium">No ticket types yet</p>
                                  <p className="text-sm text-gray-500">Click &quot;Edit Ticket Types&quot; to add some</p>
                                </div>
                              </div>
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
