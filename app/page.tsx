"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { storage, Ticket, Department, WorkflowResolution, Workflow } from "@/lib/storage";
import { formatDate, getDaysUntilDue } from "@/lib/utils/date-calculator";
import { SLADisplay } from "@/components/ui/sla-display";
import { WorkflowProgressBadge } from "@/components/ui/workflow-progress-badge";
import { DepartmentActionModal } from "@/components/DepartmentActionModal";
import { ReassignmentModal } from "@/components/ReassignmentModal";
import { showToast, ClientToastContainer } from "@/components/ui/client-toast";
import { Plus, Ticket as TicketIcon, AlertTriangle, Settings, ChevronLeft, ChevronRight, X, Check, Eye, Edit, Filter, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Helper function to check if text is truncated
const isTextTruncated = (text: string, maxWidth: number = 200): boolean => {
  // Rough estimation: average character width is about 8px, so we calculate approximate width
  const estimatedWidth = text.length * 8;
  return estimatedWidth > maxWidth;
};

// Helper function to get workflow SLA for a ticket
const getWorkflowSLA = (ticket: Ticket, workflows: Workflow[]) => {
  const workflowId = ticket.workflowId;

  if (!workflowId) {
    // If no workflow assigned, use default workflow
    const defaultWorkflow = workflows.find((w) => w.isDefault);
    if (!defaultWorkflow) return ticket.sla;

    const totalDays = defaultWorkflow.steps.reduce((total, step) => total + (step.estimatedDays || 1), 0);
    const unit = defaultWorkflow.steps[0]?.slaUnit || "days";
    return {
      value: totalDays,
      unit: unit === "hours" ? ("hours" as const) : ("days" as const),
    };
  }

  const workflow = workflows.find((w) => w.id === workflowId);
  if (!workflow) return ticket.sla;

  const totalDays = workflow.steps.reduce((total, step) => total + (step.estimatedDays || 1), 0);
  const unit = workflow.steps[0]?.slaUnit || "days";
  return {
    value: totalDays,
    unit: unit === "hours" ? ("hours" as const) : ("days" as const),
  };
};

// Helper function to get total workflow steps for a ticket
const getWorkflowTotalSteps = (ticket: Ticket, workflows: Workflow[]) => {
  const workflowId = ticket.workflowId;

  if (!workflowId) {
    // If no workflow assigned, use default workflow
    const defaultWorkflow = workflows.find((w) => w.isDefault);
    return defaultWorkflow?.steps.length || 4;
  }

  const workflow = workflows.find((w) => w.id === workflowId);
  return workflow?.steps.length || 4;
};

export default function Home() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowResolutions, setWorkflowResolutions] = useState<Map<string, WorkflowResolution[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [mounted, setMounted] = useState(false);

  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    priority: "all",
    dateFilter: {
      type: null as "created" | "due" | null, // null means no date filter type selected
      from: undefined as Date | undefined,
      to: undefined as Date | undefined,
    },
  });

  const [selectedDepartment, setSelectedDepartment] = useState<string>("All");
  const [scrollPosition, setScrollPosition] = useState<number>(0);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [ticketsPerPage, setTicketsPerPage] = useState<number>(20);

  // Confirmation modal state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<{
    type: "edit" | "close";
    ticketId: string;
    field?: string;
    newValue?: string;
  } | null>(null);

  // Department action modal state
  const [showDepartmentAction, setShowDepartmentAction] = useState(false);
  const [selectedTicketForAction, setSelectedTicketForAction] = useState<Ticket | null>(null);
  const [showReassignmentModal, setShowReassignmentModal] = useState(false);
  const [selectedTicketForReassignment, setSelectedTicketForReassignment] = useState<{
    id: string;
    currentAssignee?: string;
    currentDepartment?: string;
  } | null>(null);

  // Inline editing state

  // Calendar state for push due date

  const loadData = async () => {
    try {
      await storage.init();

      // Check if we need to seed data
      const existingDepartments = await storage.getDepartments();
      if (existingDepartments.length === 0) {
        const departmentsData = await import("@/data/departments.json");
        await storage.seedDepartments(departmentsData.default);
        await storage.seedSampleTickets();
      }

      // Ensure default workflow exists
      await storage.seedDefaultWorkflow();

      // Ensure users are seeded once departments exist
      const [ticketsData, departmentsData, workflowsData] = await Promise.all([storage.getTickets(), storage.getDepartments(), storage.getWorkflows()]);
      await storage.seedUsersIfEmpty();
      setTickets(ticketsData);
      setDepartments(departmentsData);
      setWorkflows(workflowsData);

      // Load workflow resolutions for all tickets
      const resolutionsMap = new Map();
      for (const ticket of ticketsData) {
        try {
          const resolutions = await storage.getWorkflowResolutions(ticket.id);
          resolutionsMap.set(ticket.id, resolutions);
        } catch (error) {
          console.error(`Error loading resolutions for ticket ${ticket.id}:`, error);
          resolutionsMap.set(ticket.id, []);
        }
      }
      setWorkflowResolutions(resolutionsMap);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = useCallback(() => {
    let filtered = [...tickets];

    // Apply department filter first
    if (selectedDepartment !== "All") {
      filtered = filtered.filter((ticket) => ticket.department === selectedDepartment);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((ticket) => ticket.clientName.toLowerCase().includes(searchLower) || ticket.ticketType.toLowerCase().includes(searchLower));
    }

    if (filters.status && filters.status !== "all") {
      filtered = filtered.filter((ticket) => ticket.status === filters.status);
    }

    if (filters.priority && filters.priority !== "all") {
      filtered = filtered.filter((ticket) => ticket.priority === filters.priority);
    }

    // Advanced date filtering
    if (filters.dateFilter.type && filters.dateFilter.from && mounted) {
      const fromDate = new Date(filters.dateFilter.from);
      fromDate.setHours(0, 0, 0, 0);

      const toDate = filters.dateFilter.to ? new Date(filters.dateFilter.to) : fromDate;
      toDate.setHours(23, 59, 59, 999); // End of day for range

      filtered = filtered.filter((ticket) => {
        let ticketDate: Date;

        // Choose which date to filter by
        if (filters.dateFilter.type === "created") {
          ticketDate = new Date(ticket.createdAt);
        } else if (filters.dateFilter.type === "due") {
          ticketDate = new Date(ticket.dueDate);
        } else {
          return true; // Should not happen, but safety check
        }

        return ticketDate >= fromDate && ticketDate <= toDate;
      });
    }

    setFilteredTickets(filtered);
    setCurrentPage(1);
  }, [tickets, selectedDepartment, filters, mounted]);

  // Pagination logic
  const totalTickets = filteredTickets.length;
  const totalPages = Math.ceil(totalTickets / ticketsPerPage);

  // Count tickets due today
  const ticketsDueToday = filteredTickets.filter((ticket) => getDaysUntilDue(ticket.dueDate) === 0).length;
  const startIndex = (currentPage - 1) * ticketsPerPage;
  const endIndex = startIndex + ticketsPerPage;
  const paginatedTickets = filteredTickets.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleTicketsPerPageChange = (value: string) => {
    setTicketsPerPage(parseInt(value));
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  useEffect(() => {
    setMounted(true);
    loadData();
  }, []);

  useEffect(() => {
    if (mounted) {
      applyFilters();
    }
  }, [tickets, filters, mounted, selectedDepartment, applyFilters]);

  const handleScroll = (direction: "left" | "right") => {
    const container = document.getElementById("department-nav");
    if (!container) return;

    const scrollAmount = 200;
    const newPosition = direction === "left" ? Math.max(0, scrollPosition - scrollAmount) : scrollPosition + scrollAmount;

    container.scrollTo({ left: newPosition, behavior: "smooth" });
    setScrollPosition(newPosition);

    // Check if we can scroll further right
    setTimeout(() => {
      const canScroll = container.scrollWidth > container.clientWidth + newPosition;
      setCanScrollRight(canScroll);
    }, 100);
  };

  const handleCloseTicket = async (ticketId: string) => {
    try {
      await storage.closeTicket(ticketId);
      const updatedTickets = await storage.getTickets();
      setTickets(updatedTickets);
      setShowConfirmation(false);
      setConfirmationAction(null);
      showToast("Ticket closed successfully!", "success");
    } catch (error) {
      console.error("Error closing ticket:", error);
      showToast("Failed to close ticket", "error");
    }
  };

  const handleDepartmentAction = async (isComplete: boolean, notes: string, assignee?: string) => {
    if (!selectedTicketForAction) return;

    try {
      const currentStep = storage.getCurrentWorkflowStep(selectedTicketForAction);
      if (!currentStep) {
        showToast("No current workflow step found", "error");
        return;
      }

      // Determine action type based on completion status
      const actionType = isComplete ? "completed" : "in_progress";

      // Add department action
      const updatedTicket = await storage.addDepartmentAction(selectedTicketForAction.id, currentStep.stepNumber, actionType, notes, isComplete, selectedTicketForAction.assignee, assignee);

      // Optionally reassign current assignee when in progress
      if (!isComplete && assignee) {
        await storage.updateTicket(selectedTicketForAction.id, { assignee });
      }

      // Refresh tickets
      const updatedTickets = await storage.getTickets();
      setTickets(updatedTickets);

      showToast(`Action ${isComplete ? "completed" : "started"} successfully!`, "success");
    } catch (error) {
      console.error("Error adding department action:", error);
      showToast("Failed to add department action", "error");
    }
  };

  const handleReassignTicket = (ticketId: string, currentAssignee?: string, currentDepartment?: string) => {
    setSelectedTicketForReassignment({
      id: ticketId,
      currentAssignee,
      currentDepartment,
    });
    setShowReassignmentModal(true);
  };

  const handleReassigned = async (_newAssignee: string) => {
    if (!selectedTicketForReassignment) return;

    try {
      // Refresh tickets to get updated data
      const updatedTickets = await storage.getTickets();
      setTickets(updatedTickets);
      setShowReassignmentModal(false);
      setSelectedTicketForReassignment(null);
    } catch (error) {
      console.error("Error refreshing tickets after reassignment:", error);
    }
  };

  const openDepartmentAction = (ticket: Ticket) => {
    const currentStep = storage.getCurrentWorkflowStep(ticket);
    if (!currentStep) {
      showToast("No workflow step available for this ticket", "error");
      return;
    }

    setSelectedTicketForAction(ticket);
    setShowDepartmentAction(true);
  };

  const getStatusCount = (status: string) => {
    return tickets.filter((ticket) => ticket.status === status).length;
  };

  const getTicketNumber = (ticketId: string) => {
    // Extract numeric part and show only the last 4 digits for brevity
    const match = ticketId.match(/\d+/);
    if (!match) return ticketId;
    const digits = match[0];
    return digits.length > 4 ? digits.slice(-4) : digits;
  };

  const handleTicketIdClick = (ticket: Ticket) => {
    router.push(`/ticket-details?id=${ticket.id}`);
  };

  if (loading || !mounted) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-gray-50" suppressHydrationWarning>
        {/* Page Header */}
        <div className="bg-white shadow-sm border-b px-6 py-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500">{ticketsDueToday} tickets due today</p>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/tickets/create">
                <Button className="cursor-pointer">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Ticket
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Status Filter Cards */}
        <div className="w-full px-6 py-2 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            {/* Total Card */}
            <div className={`flex items-center gap-3 px-4 py-2 rounded-full cursor-pointer transition-all duration-200 ${filters.status === "all" ? "bg-slate-600 text-white shadow-lg" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`} onClick={() => setFilters({ ...filters, status: "all" })}>
              <TicketIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Total</span>
              <span className="text-sm font-bold" suppressHydrationWarning>
                {tickets.length}
              </span>
            </div>

            {/* Open Card */}
            <div className={`flex items-center gap-3 px-4 py-2 rounded-full cursor-pointer transition-all duration-200 ${filters.status === "Open" ? "bg-blue-500 text-white shadow-lg" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`} onClick={() => setFilters({ ...filters, status: "Open" })}>
              <div className="h-4 w-4 bg-blue-600 rounded-full flex items-center justify-center">
                <div className="h-2 w-2 bg-white rounded-full"></div>
              </div>
              <span className="text-sm font-medium">Open</span>
              <span className="text-sm font-bold" suppressHydrationWarning>
                {getStatusCount("Open")}
              </span>
            </div>

            {/* In Progress Card */}
            <div className={`flex items-center gap-3 px-4 py-2 rounded-full cursor-pointer transition-all duration-200 ${filters.status === "In Progress" ? "bg-amber-500 text-white shadow-lg" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`} onClick={() => setFilters({ ...filters, status: "In Progress" })}>
              <div className="h-4 w-4 bg-amber-600 rounded-full flex items-center justify-center">
                <div className="h-2 w-2 bg-white rounded-full"></div>
              </div>
              <span className="text-sm font-medium">In Progress</span>
              <span className="text-sm font-bold" suppressHydrationWarning>
                {getStatusCount("In Progress")}
              </span>
            </div>

            {/* Resolved Card */}
            <div className={`flex items-center gap-3 px-4 py-2 rounded-full cursor-pointer transition-all duration-200 ${filters.status === "Resolved" ? "bg-green-500 text-white shadow-lg" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`} onClick={() => setFilters({ ...filters, status: "Resolved" })}>
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">Resolved</span>
              <span className="text-sm font-bold" suppressHydrationWarning>
                {getStatusCount("Resolved")}
              </span>
            </div>

            {/* Overdue Card */}
            <div className={`flex items-center gap-3 px-4 py-2 rounded-full cursor-pointer transition-all duration-200 ${filters.status === "Overdue" ? "bg-red-500 text-white shadow-lg" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`} onClick={() => setFilters({ ...filters, status: "Overdue" })}>
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Overdue</span>
              <span className="text-sm font-bold" suppressHydrationWarning>
                {getStatusCount("Overdue")}
              </span>
            </div>

            {/* Closed Card */}
            <div className={`flex items-center gap-3 px-4 py-2 rounded-full cursor-pointer transition-all duration-200 ${filters.status === "Closed" ? "bg-gray-600 text-white shadow-lg" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`} onClick={() => setFilters({ ...filters, status: "Closed" })}>
              <X className="h-4 w-4" />
              <span className="text-sm font-medium">Closed</span>
              <span className="text-sm font-bold" suppressHydrationWarning>
                {getStatusCount("Closed")}
              </span>
            </div>
          </div>

          {/* Department Navigation */}
          <div className="mb-2 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Departments</h2>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => handleScroll("left")} disabled={scrollPosition === 0} className="cursor-pointer">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleScroll("right")} disabled={!canScrollRight} className="cursor-pointer">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex space-x-2 overflow-x-auto scrollbar-hide" id="department-nav">
              <Button variant={selectedDepartment === "All" ? "default" : "outline"} size="sm" onClick={() => setSelectedDepartment("All")} className="cursor-pointer">
                All ({tickets.length})
              </Button>
              {departments.map((dept) => (
                <Button key={dept.id} variant={selectedDepartment === dept.name ? "default" : "outline"} size="sm" onClick={() => setSelectedDepartment(dept.name)} className="cursor-pointer">
                  {dept.name} ({tickets.filter((t) => t.department === dept.name).length})
                </Button>
              ))}
            </div>
          </div>
          {/* Tickets Table */}
          <Card className="overflow-hidden p-0 flex-1 flex flex-col">
            {/* Search and Filters Bar - Now part of the table area */}
            <div className="px-4 py-1 border-b bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Input placeholder="Search tickets..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="h-8 w-48 text-xs" />

                <Select value={filters.priority} onValueChange={(value) => setFilters({ ...filters, priority: value })}>
                  <SelectTrigger className="h-8 w-28 text-xs cursor-pointer">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
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

                {/* Advanced Date Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-8 px-3 text-xs justify-start text-left font-normal cursor-pointer">
                      <Filter className="h-3 w-3 mr-2" />
                      {filters.dateFilter.type === null ? (
                        "Date Filter"
                      ) : (
                        <span className="truncate">
                          {filters.dateFilter.type === "created" ? "Created" : "Due"} - {filters.dateFilter.from ? (filters.dateFilter.to && filters.dateFilter.to.getTime() !== filters.dateFilter.from.getTime() ? `${formatDate(filters.dateFilter.from)} to ${formatDate(filters.dateFilter.to)}` : formatDate(filters.dateFilter.from)) : "Select Date Range"}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" align="start">
                    <div className="space-y-3">
                      {/* Date Type Selection */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">Filter by:</label>
                        <div className="flex gap-1">
                          <Button
                            variant={filters.dateFilter.type === "created" ? "default" : "outline"}
                            size="sm"
                            onClick={() =>
                              setFilters({
                                ...filters,
                                dateFilter: { type: "created", from: undefined, to: undefined },
                              })
                            }
                            className="text-xs h-7 px-2 cursor-pointer"
                          >
                            Created Date
                          </Button>
                          <Button
                            variant={filters.dateFilter.type === "due" ? "default" : "outline"}
                            size="sm"
                            onClick={() =>
                              setFilters({
                                ...filters,
                                dateFilter: { type: "due", from: undefined, to: undefined },
                              })
                            }
                            className="text-xs h-7 px-2 cursor-pointer"
                          >
                            Due Date
                          </Button>
                        </div>
                      </div>

                      {/* Selected Range Display */}
                      {filters.dateFilter.type && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-700">Selected Range:</label>
                          <div className="p-1.5 bg-gray-50 rounded text-xs">
                            {filters.dateFilter.from ? (
                              <div className="space-y-0.5">
                                <div>
                                  <span className="font-medium">From:</span> {formatDate(filters.dateFilter.from)}
                                </div>
                                {filters.dateFilter.to && (
                                  <div>
                                    <span className="font-medium">To:</span> {formatDate(filters.dateFilter.to)}
                                    {filters.dateFilter.to.getTime() === filters.dateFilter.from.getTime() && <span className="text-gray-500 ml-1">(Single date)</span>}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-500">No date range selected</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Calendar - Show when date type is selected */}
                      {filters.dateFilter.type && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-700">Select {filters.dateFilter.type === "created" ? "Created" : "Due"} Date Range:</label>
                          <Calendar
                            mode="range"
                            selected={{
                              from: filters.dateFilter.from,
                              to: filters.dateFilter.to,
                            }}
                            onSelect={(range) =>
                              setFilters({
                                ...filters,
                                dateFilter: {
                                  ...filters.dateFilter,
                                  from: range?.from,
                                  to: range?.to,
                                },
                              })
                            }
                            className="rounded-md border text-xs [&_.rdp-month]:w-full [&_.rdp-table]:w-full [&_.rdp-day]:h-7 [&_.rdp-day]:w-7 [&_.rdp-day]:text-xs [&_.rdp-head_cell]:h-6 [&_.rdp-head_cell]:text-xs [&_.rdp-caption]:h-6 [&_.rdp-caption]:text-xs"
                          />
                        </div>
                      )}

                      {/* Clear Button */}
                      {filters.dateFilter.type && (
                        <div className="pt-1 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setFilters({
                                ...filters,
                                dateFilter: { type: null, from: undefined, to: undefined },
                              })
                            }
                            className="w-full text-xs h-7 cursor-pointer"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Clear Date Filter
                          </Button>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {(filters.search || filters.status !== "all" || filters.priority !== "all" || filters.dateFilter.type !== null) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFilters({
                        search: "",
                        status: "all",
                        priority: "all",
                        dateFilter: { type: null, from: undefined, to: undefined },
                      })
                    }
                    className="h-8 text-xs cursor-pointer"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="overflow-auto flex-1 max-h-[calc(100vh-360px)]">
              <table className="w-full min-w-[1400px]">
                {/* Header Row */}
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {selectedDepartment === "All" && <th className="w-40 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>}
                    <th className="w-32 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket ID</th>
                    <th className="w-48 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Name</th>
                    <th className="w-40 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket Type</th>
                    <th className="w-36 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignee</th>
                    <th className="w-32 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="w-20 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                    <th className="w-20 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLA</th>
                    <th className="w-24 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                    <th className="w-24 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Left</th>
                    <th className="w-32 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="w-32 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                    <th className="w-20 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedTickets.map((ticket) => {
                    const isOverdueTicket = ticket.status === "Overdue";
                    const isResolved = ticket.status === "Resolved";
                    const isClosed = ticket.status === "Closed";

                    return (
                      <tr key={ticket.id} className={`hover:bg-gray-50 transition-colors ${isOverdueTicket ? "bg-red-50 hover:bg-red-100" : isResolved ? "bg-green-50 hover:bg-green-100" : isClosed ? "bg-gray-100 hover:bg-gray-200" : ""}`}>
                        {selectedDepartment === "All" && <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{ticket.department}</td>}
                        <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                          <button onClick={() => handleTicketIdClick(ticket)} className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors cursor-pointer">
                            {getTicketNumber(ticket.id)}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                          {isTextTruncated(ticket.clientName, 150) ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate block max-w-[150px]">{ticket.clientName}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{ticket.clientName}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            ticket.clientName
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                          {isTextTruncated(ticket.ticketType, 120) ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate block max-w-[120px]">{ticket.ticketType}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{ticket.ticketType}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            ticket.ticketType
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>{ticket.assignee || "—"}</span>
                            <Button variant="ghost" size="sm" onClick={() => handleReassignTicket(ticket.id, ticket.assignee, ticket.currentDepartment)} className="h-6 w-6 p-0 hover:bg-gray-100" title="Reassign ticket">
                              <Edit className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={`${(() => {
                              switch (ticket.status) {
                                case "Open":
                                  return "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
                                case "In Progress":
                                  return "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100";
                                case "Resolved":
                                  return "bg-green-50 text-green-700 border-green-200 hover:bg-green-100";
                                case "Overdue":
                                  return "bg-red-50 text-red-700 border-red-200 hover:bg-red-100";
                                default:
                                  return "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100";
                              }
                            })()}`}
                          >
                            {ticket.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-sm whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={`${(() => {
                              switch (ticket.priority) {
                                case "Low":
                                  return "bg-green-50 text-green-700 border-green-200 hover:bg-green-100";
                                case "Medium":
                                  return "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100";
                                case "High":
                                  return "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100";
                                case "Critical":
                                  return "bg-red-50 text-red-700 border-red-200 hover:bg-red-100";
                                default:
                                  return "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100";
                              }
                            })()}`}
                          >
                            {ticket.priority}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                          <SLADisplay sla={getWorkflowSLA(ticket, workflows)} />
                        </td>
                        <td className="px-3 py-2 text-sm whitespace-nowrap">
                          <WorkflowProgressBadge currentStep={ticket.currentWorkflowStep || 1} totalSteps={getWorkflowTotalSteps(ticket, workflows)} resolutions={workflowResolutions.get(ticket.id) || []} currentDepartment={ticket.currentDepartment} isFullyResolved={ticket.isFullyResolved} status={ticket.status} ticketCreatedAt={ticket.createdAt} workflowStatus={ticket.workflowStatus} />
                        </td>
                        <td className="px-3 py-2 text-sm whitespace-nowrap" suppressHydrationWarning>
                          {(() => {
                            // If ticket is resolved, show "Resolved" instead of counting days
                            if (ticket.status === "Resolved") {
                              return <span className="text-green-600 font-medium">Resolved</span>;
                            }

                            // If ticket is closed, show "Closed" instead of counting days
                            if (ticket.status === "Closed") {
                              return <span className="text-gray-600 font-medium">Closed</span>;
                            }

                            const daysLeft = getDaysUntilDue(ticket.dueDate);
                            if (daysLeft < 0) {
                              return <span className="text-red-600 font-medium">Overdue</span>;
                            } else if (daysLeft === 0) {
                              return <span className="text-orange-600 font-medium">Due Today</span>;
                            } else if (daysLeft <= 1) {
                              return <span className="text-orange-600">{daysLeft}d</span>;
                            } else if (daysLeft <= 3) {
                              return <span className="text-yellow-600">{daysLeft}d</span>;
                            } else {
                              return <span className="text-green-600">{daysLeft}d</span>;
                            }
                          })()}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap" suppressHydrationWarning>
                          {formatDate(ticket.createdAt)}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap" suppressHydrationWarning>
                          {formatDate(ticket.dueDate)}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap">
                          <div className="flex space-x-1">
                            {/* Department Action Button */}
                            {ticket.status !== "Closed" && ticket.status !== "Resolved" && (
                              <Button variant="ghost" size="sm" onClick={() => openDepartmentAction(ticket)} className="cursor-pointer text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Take action on this ticket">
                                <PlayCircle className="h-4 w-4" />
                              </Button>
                            )}

                            <Link href={`/ticket-details?id=${ticket.id}`}>
                              <Button variant="ghost" size="sm" className="cursor-pointer">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/ticket?id=${ticket.id}&mode=edit`}>
                              <Button variant="ghost" size="sm" className="cursor-pointer">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            {ticket.status !== "Closed" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setConfirmationAction({ type: "close", ticketId: ticket.id });
                                  setShowConfirmation(true);
                                }}
                                className="cursor-pointer"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700" suppressHydrationWarning>
              Showing {startIndex + 1} to {Math.min(endIndex, totalTickets)} of {totalTickets} tickets
            </div>

            {/* Tickets per page selector in the middle */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">Show:</span>
              <Select value={ticketsPerPage.toString()} onValueChange={handleTicketsPerPageChange}>
                <SelectTrigger className="w-20 h-6 text-xs cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-700">per page</span>
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="cursor-pointer">
                Previous
              </Button>

              {/* Page numbers */}
              <div className="flex space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button key={pageNum} variant={currentPage === pageNum ? "default" : "outline"} size="sm" onClick={() => handlePageChange(pageNum)} className="cursor-pointer">
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="cursor-pointer">
                Next
              </Button>
            </div>
          </div>
        </div>

        {/* Confirmation Modal */}
        <ConfirmationModal
          isOpen={showConfirmation}
          onClose={() => {
            setShowConfirmation(false);
            setConfirmationAction(null);
          }}
          onConfirm={() => {
            if (confirmationAction?.type === "close") {
              handleCloseTicket(confirmationAction.ticketId);
            }
          }}
          title="Confirm Action"
          description={`Are you sure you want to ${confirmationAction?.type === "close" ? "close" : "update"} this ticket?`}
          variant="destructive"
        />

        {/* Department Action Modal */}
        <DepartmentActionModal
          isOpen={showDepartmentAction}
          onClose={() => {
            setShowDepartmentAction(false);
            setSelectedTicketForAction(null);
          }}
          onConfirm={handleDepartmentAction}
          ticket={selectedTicketForAction}
          currentStep={selectedTicketForAction ? storage.getCurrentWorkflowStep(selectedTicketForAction) : null}
        />

        {/* Reassignment Modal */}
        <ReassignmentModal
          isOpen={showReassignmentModal}
          onClose={() => {
            setShowReassignmentModal(false);
            setSelectedTicketForReassignment(null);
          }}
          ticketId={selectedTicketForReassignment?.id || ""}
          currentAssignee={selectedTicketForReassignment?.currentAssignee}
          currentDepartment={selectedTicketForReassignment?.currentDepartment}
          onReassigned={handleReassigned}
        />
      </div>

      <ClientToastContainer />
    </TooltipProvider>
  );
}
