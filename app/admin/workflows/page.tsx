"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { storage, Department, Workflow, WorkflowStep } from "@/lib/storage";
import { Plus, Edit, Trash2, Save, GripVertical, ArrowLeft, Star, StarOff } from "lucide-react";
import { ClientToastContainer, showToast } from "@/components/ui/client-toast";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Sortable Step Card Component
function SortableStepCard({ step, index, onUpdate, onRemove, departments }: { step: WorkflowStep; index: number; onUpdate: (index: number, field: keyof WorkflowStep, value: string | number | boolean) => void; onRemove: (index: number) => void; departments: Department[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const department = departments.find((d) => d.id === step.departmentId);

  return (
    <div ref={setNodeRef} style={style} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div {...attributes} {...listeners} className="p-1 cursor-grab active:cursor-grabbing">
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
          <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">{index + 1}</div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 text-sm">{department?.name || "Unknown Department"}</h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-500">SLA:</Label>
            <Input type="number" value={step.estimatedDays || 1} onChange={(e) => onUpdate(index, "estimatedDays", parseInt(e.target.value) || 1)} className="w-16 h-8 text-xs" min="1" />
            <Select value={step.slaUnit || "days"} onValueChange={(value) => onUpdate(index, "slaUnit", value)}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Working Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove(index);
            }}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer p-1 h-8 w-8"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Department Card Component
function DepartmentCard({ department, onAddStep }: { department: Department; onAddStep: (department: Department) => void }) {
  return (
    <div onClick={() => onAddStep(department)} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer group">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">{department.name.charAt(0)}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors text-xs leading-tight break-words">{department.name}</h3>
          <p className="text-xs text-gray-500">{department.ticketTypes.length} ticket types</p>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <Plus className="w-4 h-4 text-blue-600" />
        </div>
      </div>
    </div>
  );
}

function WorkflowsPageContent() {
  const searchParams = useSearchParams();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [workflowFormData, setWorkflowFormData] = useState({
    name: "",
    description: "",
    isDefault: false,
  });
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Handle URL parameter for editing specific workflow
    const editWorkflowId = searchParams.get("edit");
    if (editWorkflowId && workflows.length > 0) {
      const workflow = workflows.find((w) => w.id === editWorkflowId);
      if (workflow) {
        startEditingWorkflow(workflow);
      }
    }
  }, [searchParams, workflows]);

  const loadData = async () => {
    try {
      await storage.init();
      const [depts, workflowsData] = await Promise.all([storage.getDepartments(), storage.getWorkflows()]);
      setDepartments(depts);
      setWorkflows(workflowsData);
    } catch (error) {
      console.error("Error loading data:", error);
      showToast("Error loading data", "error", "Failed to load workflow data");
    } finally {
      setLoading(false);
    }
  };

  const getDefaultWorkflow = () => {
    return workflows.find((w) => w.isDefault);
  };

  const resetForm = () => {
    setWorkflowFormData({
      name: "",
      description: "",
      isDefault: false,
    });
    setWorkflowSteps([]);
    setEditingWorkflow(null);
    setShowCreateForm(false);
  };

  const startEditingWorkflow = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setWorkflowFormData({
      name: workflow.name,
      description: workflow.description || "",
      isDefault: workflow.isDefault,
    });
    setWorkflowSteps([...workflow.steps]);
    setShowCreateForm(true);
  };

  const addWorkflowStep = (department: Department) => {
    const stepId = `step-${workflowSteps.length + 1}-${Date.now()}`;
    const newStep: WorkflowStep = {
      id: stepId,
      departmentId: department.id,
      departmentName: department.name,
      estimatedDays: 1,
      slaUnit: "days", // Default to working days
      isRequired: true, // All steps are always required
      stepNumber: workflowSteps.length + 1,
    };
    setWorkflowSteps([...workflowSteps, newStep]);
  };

  const updateWorkflowStep = (index: number, field: keyof WorkflowStep, value: string | number | boolean) => {
    const updatedSteps = [...workflowSteps];
    updatedSteps[index] = { ...updatedSteps[index], [field]: value };
    setWorkflowSteps(updatedSteps);
  };

  const removeWorkflowStep = (index: number) => {
    const updatedSteps = workflowSteps.filter((_, i) => i !== index);
    // Update step numbers
    const renumberedSteps = updatedSteps.map((step, i) => ({
      ...step,
      stepNumber: i + 1,
    }));
    setWorkflowSteps(renumberedSteps);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = workflowSteps.findIndex((step) => step.id === active.id);
      const newIndex = workflowSteps.findIndex((step) => step.id === over.id);

      const newSteps = arrayMove(workflowSteps, oldIndex, newIndex);
      // Update step numbers
      const renumberedSteps = newSteps.map((step, index) => ({
        ...step,
        stepNumber: index + 1,
      }));
      setWorkflowSteps(renumberedSteps);
    }
  };

  const handleCreateWorkflow = async () => {
    try {
      if (!workflowFormData.name.trim() || workflowSteps.length === 0) {
        showToast("Please provide a name and at least one step", "error");
        return;
      }

      const workflowData = {
        name: workflowFormData.name.trim(),
        description: workflowFormData.description.trim(),
        isDefault: workflowFormData.isDefault,
        steps: workflowSteps,
      };

      await storage.createWorkflow(workflowData);
      showToast("Workflow created successfully!", "success");
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error creating workflow:", error);
      showToast("Failed to create workflow", "error");
    }
  };

  const handleUpdateWorkflow = async () => {
    if (!editingWorkflow) return;

    try {
      if (!workflowFormData.name.trim() || workflowSteps.length === 0) {
        showToast("Please provide a name and at least one step", "error");
        return;
      }

      const updatedWorkflow = {
        ...editingWorkflow,
        name: workflowFormData.name.trim(),
        description: workflowFormData.description.trim(),
        isDefault: workflowFormData.isDefault,
        steps: workflowSteps,
      };

      await storage.updateWorkflow(editingWorkflow.id, updatedWorkflow);
      showToast("Workflow updated successfully!", "success");
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error updating workflow:", error);
      showToast("Failed to update workflow", "error");
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    try {
      await storage.deleteWorkflow(workflowId);
      showToast("Workflow deleted successfully!", "success");
      loadData();
    } catch (error) {
      console.error("Error deleting workflow:", error);
      showToast("Failed to delete workflow", "error");
    }
  };

  const handleSetDefault = async (workflowId: string) => {
    try {
      // First, unset any existing default
      const currentDefault = getDefaultWorkflow();
      if (currentDefault) {
        await storage.updateWorkflow(currentDefault.id, { isDefault: false });
      }

      // Set new default
      const workflow = workflows.find((w) => w.id === workflowId);
      if (workflow) {
        await storage.updateWorkflow(workflow.id, { isDefault: true });
        showToast("Default workflow updated!", "success");
        loadData();
      }
    } catch (error) {
      console.error("Error setting default workflow:", error);
      showToast("Failed to set default workflow", "error");
    }
  };

  const getDepartmentName = (departmentId: string) => {
    return departments.find((d) => d.id === departmentId)?.name || "Unknown";
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">Loading workflows...</div>
        </div>
      </div>
    );
  }

  // Full-page workflow editing view
  if (showCreateForm) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b">
          <div className="container mx-auto p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={resetForm} className="cursor-pointer">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Workflows
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">{editingWorkflow ? "Edit Workflow" : "Create New Workflow"}</h1>
                  <p className="text-gray-600">Design your ticket processing workflow</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetForm} className="cursor-pointer">
                  Cancel
                </Button>
                <Button onClick={editingWorkflow ? handleUpdateWorkflow : handleCreateWorkflow} disabled={!workflowFormData.name.trim() || workflowSteps.length === 0} className="cursor-pointer">
                  <Save className="w-4 h-4 mr-2" />
                  {editingWorkflow ? "Update Workflow" : "Create Workflow"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Workflow Details */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Workflow Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name">Workflow Name *</Label>
                    <Input id="name" value={workflowFormData.name} onChange={(e) => setWorkflowFormData({ ...workflowFormData, name: e.target.value })} placeholder="Enter workflow name" />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" value={workflowFormData.description} onChange={(e) => setWorkflowFormData({ ...workflowFormData, description: e.target.value })} placeholder="Optional description" rows={3} />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="isDefault" checked={workflowFormData.isDefault} onChange={(e) => setWorkflowFormData({ ...workflowFormData, isDefault: e.target.checked })} className="rounded" />
                    <Label htmlFor="isDefault">Set as default workflow</Label>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Workflow Steps */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Workflow Steps ({workflowSteps.length})</CardTitle>
                  <CardDescription>
                    Drag and drop to reorder steps
                    {workflowSteps.length > 0 && (
                      <span className="ml-2 text-blue-600 font-medium">
                        • Total SLA:{" "}
                        {workflowSteps.reduce((total, step) => {
                          const days = step.estimatedDays || 1;
                          return step.slaUnit === "hours" ? total + Math.ceil(days / 8) : total + days;
                        }, 0)}{" "}
                        WD
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {workflowSteps.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Plus className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-lg font-medium">No steps added yet</p>
                      <p className="text-sm">Click on departments below to add steps to your workflow</p>
                    </div>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={workflowSteps.map((step) => step.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {workflowSteps.map((step, index) => (
                            <SortableStepCard key={step.id} step={step} index={index} onUpdate={updateWorkflowStep} onRemove={removeWorkflowStep} departments={departments} />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Available Departments */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Available Departments</CardTitle>
              <CardDescription>Click on a department to add it as the next step in your workflow</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {departments.map((department) => (
                  <DepartmentCard key={department.id} department={department} onAddStep={addWorkflowStep} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <ClientToastContainer />
      </div>
    );
  }

  // Main workflows list view
  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflow Management</h1>
            <p className="text-sm text-gray-500">Create and manage ticket processing workflows</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateForm(true)} className="cursor-pointer">
              <Plus className="w-4 h-4 mr-2" />
              Create Workflow
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Workflows Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Workflows ({workflows.length})</CardTitle>
            <CardDescription>Manage your ticket processing workflows</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Default</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Total SLA</TableHead>
                  <TableHead>Departments</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((workflow) => (
                  <TableRow key={workflow.id} className="h-16">
                    <TableCell>
                      {workflow.isDefault ? (
                        <Badge variant="default" className="bg-yellow-100 text-yellow-800">
                          <Star className="w-3 h-3 mr-1" />
                          Default
                        </Badge>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => handleSetDefault(workflow.id)} className="text-gray-400 hover:text-yellow-600 cursor-pointer">
                          <StarOff className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{workflow.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-600 max-w-xs truncate">{workflow.description || "No description"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{workflow.steps.length} steps</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        {workflow.steps.reduce((total, step) => {
                          const days = step.estimatedDays || 1;
                          return step.slaUnit === "hours" ? total + Math.ceil(days / 8) : total + days;
                        }, 0)}{" "}
                        WD
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-600 max-w-xs truncate">{workflow.steps.map((step) => getDepartmentName(step.departmentId)).join(" → ")}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEditingWorkflow(workflow)} className="cursor-pointer">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteWorkflow(workflow.id)} className="text-red-600 hover:text-red-700 cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <ClientToastContainer />
    </div>
  );
}

export default function WorkflowsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600">Loading workflows...</div>
          </div>
        </div>
      }
    >
      <WorkflowsPageContent />
    </Suspense>
  );
}
