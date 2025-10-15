"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { storage, Ticket, Department } from "@/lib/storage";
import { formatDate, isOverdue, getPriorityColor, getStatusColor, getDaysUntilDue } from "@/lib/utils/date-calculator";
import { SLADisplay } from "@/components/ui/sla-display";
import { Plus, Ticket as TicketIcon, AlertTriangle, Settings, ChevronLeft, ChevronRight, X, Trash2, Check, Eye, Edit } from "lucide-react";
import Link from "next/link";

// Helper function to check if text is truncated
const isTextTruncated = (text: string, maxWidth: number) => {
  // Rough estimation: average character width is about 8px, so we calculate approximate width
  const estimatedWidth = text.length * 8;
  return estimatedWidth > maxWidth;
};

export default function Home() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100);
  const [mounted, setMounted] = useState(false);

  const [filters, setFilters] = useState({
    search: "",
    department: "all",
    status: "all",
    priority: "all",
    dateRange: "all",
  });

  const [selectedDepartment, setSelectedDepartment] = useState<string>("All");
  const [scrollPosition, setScrollPosition] = useState<number>(0);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(true);

  // Selection state
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Confirmation modal state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<{
    type: "edit" | "delete";
    ticketId: string;
    field?: string;
    newValue?: string;
  } | null>(null);

  // Inline editing state

  // Calendar state for push due date

  // Ticket modal state
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedTicketForModal, setSelectedTicketForModal] = useState<Ticket | null>(null);

  const loadData = async () => {
    try {
      console.log("Starting data load...");
      await storage.init();
      console.log("Storage initialized");

      // Check if we need to seed data
      const existingDepartments = await storage.getDepartments();
      console.log("Existing departments:", existingDepartments.length);
      if (existingDepartments.length === 0) {
        console.log("Seeding departments...");
        const departmentsData = await import("@/data/departments.json");
        await storage.seedDepartments(departmentsData.default);
        await storage.seedSampleTickets();
        console.log("Departments seeded");
      }

      console.log("Loading tickets and departments...");
      const [ticketsData, departmentsData] = await Promise.all([storage.getTickets(), storage.getDepartments()]);
      console.log("Loaded tickets:", ticketsData.length, "departments:", departmentsData.length);
      setTickets(ticketsData);
      setDepartments(departmentsData);
      console.log("Data loaded successfully");
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      console.log("Setting loading to false");
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("useEffect: setting mounted to true");
    setMounted(true);
    console.log("useEffect: calling loadData");
    loadData();
  }, []);

  useEffect(() => {
    if (mounted) {
      applyFilters();
    }
  }, [tickets, filters, mounted, selectedDepartment]);

  const applyFilters = () => {
    let filtered = [...tickets];

    // Apply department filter first
    if (selectedDepartment !== "All") {
      filtered = filtered.filter((ticket) => ticket.department === selectedDepartment);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((ticket) => ticket.clientName.toLowerCase().includes(searchLower) || ticket.ticketType.toLowerCase().includes(searchLower));
    }

    if (filters.department && filters.department !== "all") {
      filtered = filtered.filter((ticket) => ticket.department === filters.department);
    }

    if (filters.status && filters.status !== "all") {
      filtered = filtered.filter((ticket) => ticket.status === filters.status);
    }

    if (filters.priority && filters.priority !== "all") {
      filtered = filtered.filter((ticket) => ticket.priority === filters.priority);
    }

    if (filters.dateRange && filters.dateRange !== "all" && mounted) {
      const today = new Date();
      const filterDate = new Date();

      switch (filters.dateRange) {
        case "today":
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter((ticket) => {
            const ticketDate = new Date(ticket.createdAt);
            ticketDate.setHours(0, 0, 0, 0);
            return ticketDate.getTime() === filterDate.getTime();
          });
          break;
        case "week":
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter((ticket) => new Date(ticket.createdAt) >= weekAgo);
          break;
        case "month":
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter((ticket) => new Date(ticket.createdAt) >= monthAgo);
          break;
      }
    }

    setFilteredTickets(filtered);
    setCurrentPage(1);
  };

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

  const handleDeleteTicket = async (ticketId: string) => {
    try {
      await storage.deleteTicket(ticketId);
      const updatedTickets = await storage.getTickets();
      setTickets(updatedTickets);
      setShowConfirmation(false);
      setConfirmationAction(null);
    } catch (error) {
      console.error("Error deleting ticket:", error);
    }
  };

  const handleBulkAction = async (action: "delete" | "updateStatus") => {
    if (selectedTickets.size === 0) return;

    try {
      for (const ticketId of selectedTickets) {
        if (action === "delete") {
          await storage.deleteTicket(ticketId);
        } else if (action === "updateStatus") {
          await storage.updateTicket(ticketId, { status: "Resolved" });
        }
      }

      const updatedTickets = await storage.getTickets();
      setTickets(updatedTickets);
      setSelectedTickets(new Set());
      setShowBulkActions(false);
    } catch (error) {
      console.error("Error performing bulk action:", error);
    }
  };

  const handleTicketSelection = (ticketId: string, selected: boolean) => {
    const newSelection = new Set(selectedTickets);
    if (selected) {
      newSelection.add(ticketId);
    } else {
      newSelection.delete(ticketId);
    }
    setSelectedTickets(newSelection);
    setShowBulkActions(newSelection.size > 0);
  };

  const getStatusCount = (status: string) => {
    return tickets.filter((ticket) => ticket.status === status).length;
  };

  const getTicketNumber = (ticketId: string) => {
    // Extract numeric part from ticket ID (e.g., "id_123" -> "123")
    const match = ticketId.match(/\d+/);
    return match ? match[0] : ticketId;
  };

  const handleTicketIdClick = (ticket: Ticket) => {
    setSelectedTicketForModal(ticket);
    setShowTicketModal(true);
  };

  console.log("Render check - loading:", loading, "mounted:", mounted);

  if (loading || !mounted) {
    console.log("Showing loading spinner");
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
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <TicketIcon className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Real Estate Ticketing System</h1>
                  <p className="text-sm text-gray-500">Manage and track all support tickets</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="cursor-pointer">
                    <Settings className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                </Link>
                <Link href="/tickets/create">
                  <Button className="cursor-pointer">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Ticket
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Status Filter Cards */}
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
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

            {/* Overdue Card */}
            <div className={`flex items-center gap-3 px-4 py-2 rounded-full cursor-pointer transition-all duration-200 ${filters.status === "Overdue" ? "bg-red-500 text-white shadow-lg" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`} onClick={() => setFilters({ ...filters, status: "Overdue" })}>
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Overdue</span>
              <span className="text-sm font-bold" suppressHydrationWarning>
                {getStatusCount("Overdue")}
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
          </div>

          {/* Department Navigation */}
          <div className="mb-4">
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

          {/* Bulk Actions */}
          {showBulkActions && (
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{selectedTickets.size} ticket(s) selected</span>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleBulkAction("updateStatus")} className="cursor-pointer">
                      Mark as Resolved
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setConfirmationAction({ type: "delete", ticketId: Array.from(selectedTickets)[0] });
                        setShowConfirmation(true);
                      }}
                      className="cursor-pointer"
                    >
                      Delete Selected
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters Bar */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-2 flex-wrap">
              <Input placeholder="Search tickets..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="h-8 w-48 text-xs" />

              {selectedDepartment === "All" && (
                <Select value={filters.department} onValueChange={(value) => setFilters({ ...filters, department: value })}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue placeholder="Dept" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Depts</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={filters.priority} onValueChange={(value) => setFilters({ ...filters, priority: value })}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.dateRange} onValueChange={(value) => setFilters({ ...filters, dateRange: value })}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>

              {(filters.search || filters.department !== "all" || filters.status !== "all" || filters.priority !== "all" || filters.dateRange !== "all") && (
                <Button variant="outline" size="sm" onClick={() => setFilters({ search: "", department: "all", status: "all", priority: "all", dateRange: "all" })} className="h-8 text-xs">
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Tickets Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1400px]">
                  {/* Header Row */}
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-8 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                      {selectedDepartment === "All" && <th className="w-40 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>}
                      <th className="w-32 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket ID</th>
                      <th className="w-48 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Name</th>
                      <th className="w-40 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket Type</th>
                      <th className="w-32 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="w-20 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                      <th className="w-20 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLA</th>
                      <th className="w-24 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Left</th>
                      <th className="w-32 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="w-32 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                      <th className="w-20 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTickets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((ticket) => {
                      const isOverdueTicket = ticket.status === "Overdue";
                      const isResolved = ticket.status === "Resolved";

                      return (
                        <tr key={ticket.id} className={`hover:bg-gray-50 transition-colors ${isOverdueTicket ? "bg-red-50 hover:bg-red-100" : isResolved ? "bg-green-50 hover:bg-green-100" : ""}`}>
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={selectedTickets.has(ticket.id)} onChange={(e) => handleTicketSelection(ticket.id, e.target.checked)} className="rounded border-gray-300" />
                          </td>
                          {selectedDepartment === "All" && <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{ticket.department}</td>}
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            <button onClick={() => handleTicketIdClick(ticket)} className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors">
                              #{getTicketNumber(ticket.id)}
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
                          <td className="px-3 py-2 text-sm whitespace-nowrap">
                            <Badge variant={getStatusColor(ticket.status)}>{ticket.status}</Badge>
                          </td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap">
                            <Badge variant={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            <SLADisplay sla={ticket.sla} />
                          </td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap" suppressHydrationWarning>
                            {(() => {
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
                              <Link href={`/ticket/${ticket.id}`}>
                                <Button variant="ghost" size="sm" className="cursor-pointer">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Link href={`/ticket/${ticket.id}/edit`}>
                                <Button variant="ghost" size="sm" className="cursor-pointer">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setConfirmationAction({ type: "delete", ticketId: ticket.id });
                                  setShowConfirmation(true);
                                }}
                                className="cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {filteredTickets.length > itemsPerPage && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700" suppressHydrationWarning>
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredTickets.length)} of {filteredTickets.length} results
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.min(Math.ceil(filteredTickets.length / itemsPerPage), currentPage + 1))} disabled={currentPage === Math.ceil(filteredTickets.length / itemsPerPage)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        <ConfirmationModal
          isOpen={showConfirmation}
          onClose={() => {
            setShowConfirmation(false);
            setConfirmationAction(null);
          }}
          onConfirm={() => {
            if (confirmationAction?.type === "delete") {
              handleDeleteTicket(confirmationAction.ticketId);
            }
          }}
          title="Confirm Action"
          description={`Are you sure you want to ${confirmationAction?.type === "delete" ? "delete" : "update"} this ticket?`}
          variant="destructive"
        />

        {/* Ticket Details Modal */}
        {showTicketModal && selectedTicketForModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-900">Ticket #{getTicketNumber(selectedTicketForModal.id)}</h2>
                    <Badge className={getStatusColor(selectedTicketForModal.status)}>{selectedTicketForModal.status}</Badge>
                    {selectedTicketForModal.status === "Overdue" && (
                      <Badge variant="destructive">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Overdue
                      </Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowTicketModal(false)} className="text-gray-500 hover:text-gray-700 cursor-pointer">
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {/* Ticket Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Department</label>
                      <p className="text-sm text-gray-900">{selectedTicketForModal.department}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Ticket Type</label>
                      <p className="text-sm text-gray-900">{selectedTicketForModal.ticketType}</p>
                    </div>
                    {selectedTicketForModal.subCategory && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Sub-Category</label>
                        <p className="text-sm text-gray-900">{selectedTicketForModal.subCategory}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-gray-600">Client Name</label>
                      <p className="text-sm text-gray-900">{selectedTicketForModal.clientName}</p>
                    </div>
                    {selectedTicketForModal.unitId && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Unit ID</label>
                        <p className="text-sm text-gray-900">{selectedTicketForModal.unitId}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-gray-600">Ticket Owner</label>
                      <p className="text-sm text-gray-900">{selectedTicketForModal.ticketOwner}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Priority</label>
                      <Badge className={getPriorityColor(selectedTicketForModal.priority)}>{selectedTicketForModal.priority}</Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">SLA</label>
                      <p className="text-sm text-gray-900">
                        <SLADisplay sla={selectedTicketForModal.sla} />
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Created</label>
                      <p className="text-sm text-gray-900" suppressHydrationWarning>
                        {formatDate(selectedTicketForModal.createdAt)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Due Date</label>
                      <p className={`text-sm ${isOverdue(selectedTicketForModal.dueDate) ? "text-red-600 font-medium" : "text-gray-900"}`} suppressHydrationWarning>
                        {formatDate(selectedTicketForModal.dueDate)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Days Left</label>
                      <p className={`text-sm font-medium ${getDaysUntilDue(selectedTicketForModal.dueDate) < 0 ? "text-red-600" : getDaysUntilDue(selectedTicketForModal.dueDate) <= 1 ? "text-orange-600" : "text-green-600"}`}>
                        {(() => {
                          const daysLeft = getDaysUntilDue(selectedTicketForModal.dueDate);
                          if (daysLeft < 0) {
                            return `${Math.abs(daysLeft)} days overdue`;
                          } else if (daysLeft === 0) {
                            return "Due today";
                          } else {
                            return `${daysLeft} days remaining`;
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedTicketForModal.description && (
                  <div className="mb-6">
                    <label className="text-sm font-medium text-gray-600">Description</label>
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedTicketForModal.description}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  <Link href={`/ticket?id=${selectedTicketForModal.id}`}>
                    <Button>
                      <Eye className="h-4 w-4 mr-2" />
                      View Full Details
                    </Button>
                  </Link>
                  <Link href={`/ticket?id=${selectedTicketForModal.id}&mode=edit`}>
                    <Button variant="outline" className="cursor-pointer">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Ticket
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowTicketModal(false);
                      setConfirmationAction({ type: "delete", ticketId: selectedTicketForModal.id });
                      setShowConfirmation(true);
                    }}
                    className="text-red-600 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
