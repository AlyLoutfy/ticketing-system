"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { storage, Ticket, Department } from "@/lib/storage";
import { formatDate, isOverdue, getPriorityColor, getStatusColor } from "@/lib/utils/date-calculator";
import { Plus, Ticket as TicketIcon, AlertTriangle, Settings, Search, ChevronLeft, ChevronRight, X, Calendar, Trash2, Edit2, Check } from "lucide-react";
import Link from "next/link";

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
    department: "",
    status: "",
    priority: "",
    dateRange: "",
  });

  // Selection state
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Inline editing state
  const [editingTicket, setEditingTicket] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Calendar state for push due date
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    setMounted(true);
    loadData();
  }, []);

  useEffect(() => {
    if (mounted) {
      applyFilters();
    }
  }, [tickets, filters, mounted]);

  const loadData = async () => {
    try {
      await storage.init();

      // Check if we need to seed data
      const existingDepartments = await storage.getDepartments();
      if (existingDepartments.length === 0) {
        console.log("Seeding database with departments and sample tickets...");
        const departmentsData = await import("@/data/departments.json");
        await storage.seedDepartments(departmentsData.default);
        await storage.seedSampleTickets();
      }

      const [ticketsData, departmentsData] = await Promise.all([storage.getTickets(), storage.getDepartments()]);
      setTickets(ticketsData);
      setDepartments(departmentsData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...tickets];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((ticket) => ticket.clientName.toLowerCase().includes(searchLower) || ticket.ticketType.toLowerCase().includes(searchLower));
    }

    if (filters.department) {
      filtered = filtered.filter((ticket) => ticket.department === filters.department);
    }

    if (filters.status) {
      filtered = filtered.filter((ticket) => ticket.status === filters.status);
    }

    if (filters.priority) {
      filtered = filtered.filter((ticket) => ticket.priority === filters.priority);
    }

    if (filters.dateRange) {
      const today = new Date();
      const filterDate = new Date();

      switch (filters.dateRange) {
        case "today":
          filtered = filtered.filter((ticket) => {
            const ticketDate = new Date(ticket.createdAt);
            return ticketDate.toDateString() === today.toDateString();
          });
          break;
        case "week":
          filterDate.setDate(today.getDate() - 7);
          filtered = filtered.filter((ticket) => new Date(ticket.createdAt) >= filterDate);
          break;
        case "month":
          filterDate.setMonth(today.getMonth() - 1);
          filtered = filtered.filter((ticket) => new Date(ticket.createdAt) >= filterDate);
          break;
        case "overdue":
          filtered = filtered.filter((ticket) => isOverdue(ticket.dueDate) && ticket.status !== "Resolved" && ticket.status !== "Rejected");
          break;
      }
    }

    setFilteredTickets(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      department: "",
      status: "",
      priority: "",
      dateRange: "",
    });
  };

  // Selection functions
  const handleSelectTicket = (ticketId: string) => {
    const newSelected = new Set(selectedTickets);
    if (newSelected.has(ticketId)) {
      newSelected.delete(ticketId);
    } else {
      newSelected.add(ticketId);
    }
    setSelectedTickets(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const handleSelectAll = () => {
    if (selectedTickets.size === currentTickets.length) {
      setSelectedTickets(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedTickets(new Set(currentTickets.map((t) => t.id)));
      setShowBulkActions(true);
    }
  };

  const clearSelection = () => {
    setSelectedTickets(new Set());
    setShowBulkActions(false);
  };

  // Bulk actions
  const handleBulkUpdateStatus = async (newStatus: string) => {
    if (selectedTickets.size === 0) return;

    try {
      const updates = Array.from(selectedTickets).map((ticketId) => storage.updateTicket(ticketId, { status: newStatus as Ticket["status"] }));
      await Promise.all(updates);
      await loadData();
      clearSelection();
    } catch (error) {
      console.error("Error updating ticket statuses:", error);
      alert("Error updating ticket statuses. Please try again.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTickets.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedTickets.size} ticket(s)?`)) return;

    try {
      const deletions = Array.from(selectedTickets).map((ticketId) => storage.deleteTicket(ticketId));
      await Promise.all(deletions);
      await loadData();
      clearSelection();
    } catch (error) {
      console.error("Error deleting tickets:", error);
      alert("Error deleting tickets. Please try again.");
    }
  };

  const handleBulkPushDueDate = async (newDueDate: string) => {
    if (selectedTickets.size === 0) return;

    try {
      const updates = Array.from(selectedTickets).map((ticketId) => storage.updateTicket(ticketId, { dueDate: new Date(newDueDate) }));
      await Promise.all(updates);
      await loadData();
      clearSelection();
      setShowCalendar(false);
    } catch (error) {
      console.error("Error updating due dates:", error);
      alert("Error updating due dates. Please try again.");
    }
  };

  // Inline editing functions
  const startEditing = (ticketId: string, field: string, currentValue: string) => {
    setEditingTicket(ticketId);
    setEditingField(field);
    setEditValue(currentValue);
  };

  const cancelEditing = () => {
    setEditingTicket(null);
    setEditingField(null);
    setEditValue("");
  };

  const saveEdit = async () => {
    if (!editingTicket || !editingField) return;

    // Get the current ticket to compare values
    const currentTicket = tickets.find((t) => t.id === editingTicket);
    if (!currentTicket) return;

    // Check if value actually changed
    let hasChanged = false;
    if (editingField === "clientName" && editValue.trim() !== currentTicket.clientName) {
      hasChanged = true;
    } else if (editingField === "status" && editValue !== currentTicket.status) {
      hasChanged = true;
    }

    if (!hasChanged) {
      cancelEditing();
      return;
    }

    // Show confirmation prompt
    const fieldName = editingField === "clientName" ? "client name" : "status";
    const oldValue = editingField === "clientName" ? currentTicket.clientName : currentTicket.status;
    const newValue = editValue.trim();

    if (!confirm(`Are you sure you want to change the ${fieldName} from "${oldValue}" to "${newValue}"?`)) {
      cancelEditing();
      return;
    }

    try {
      const updates: Partial<Ticket> = {};

      if (editingField === "clientName") {
        updates.clientName = editValue.trim();
      } else if (editingField === "status") {
        updates.status = editValue as Ticket["status"];
      }

      await storage.updateTicket(editingTicket, updates);
      await loadData();
      cancelEditing();
    } catch (error) {
      console.error("Error updating ticket:", error);
      alert("Error updating ticket. Please try again.");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  // Check if any filters are active
  const hasActiveFilters = filters.search || filters.department || filters.status || filters.priority || filters.dateRange;

  // Function to handle card clicks for filtering
  const handleCardClick = (filterType: string, filterValue: string) => {
    if (filters[filterType as keyof typeof filters] === filterValue) {
      // If already filtered by this value, clear the filter
      setFilters((prev) => ({ ...prev, [filterType]: "" }));
    } else {
      // Set the filter
      setFilters((prev) => ({ ...prev, [filterType]: filterValue }));
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTickets = filteredTickets.slice(startIndex, endIndex);

  const getOverdueCount = () => {
    return tickets.filter((ticket) => ticket.status !== "Resolved" && ticket.status !== "Rejected" && isOverdue(ticket.dueDate)).length;
  };

  const getStatusCount = (status: string) => {
    return tickets.filter((ticket) => ticket.status === status).length;
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
    <div className="h-screen flex flex-col bg-gray-50" suppressHydrationWarning>
      {/* Header */}
      <div className="flex-shrink-0 px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Real Estate Ticketing System</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/admin">
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Admin Panel
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

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <Card className={`p-4 cursor-pointer transition-all hover:shadow-md ${filters.status === "" ? "ring-2 ring-blue-500 bg-blue-50" : ""}`} onClick={() => handleCardClick("status", "")}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{tickets.length}</p>
              </div>
              <TicketIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>

          <Card className={`p-4 cursor-pointer transition-all hover:shadow-md ${filters.status === "Open" ? "ring-2 ring-blue-500 bg-blue-50" : ""}`} onClick={() => handleCardClick("status", "Open")}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Open</p>
                <p className="text-lg font-bold">{getStatusCount("Open")}</p>
              </div>
              <div className="h-3 w-3 rounded-full bg-blue-500"></div>
            </div>
          </Card>

          <Card className={`p-4 cursor-pointer transition-all hover:shadow-md ${filters.status === "In Progress" ? "ring-2 ring-purple-500 bg-purple-50" : ""}`} onClick={() => handleCardClick("status", "In Progress")}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">In Progress</p>
                <p className="text-lg font-bold">{getStatusCount("In Progress")}</p>
              </div>
              <div className="h-3 w-3 rounded-full bg-purple-500"></div>
            </div>
          </Card>

          <Card className={`p-4 cursor-pointer transition-all hover:shadow-md ${filters.status === "Resolved" ? "ring-2 ring-green-500 bg-green-50" : ""}`} onClick={() => handleCardClick("status", "Resolved")}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Resolved</p>
                <p className="text-lg font-bold text-green-600">{getStatusCount("Resolved")}</p>
              </div>
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
            </div>
          </Card>

          <Card className={`p-4 cursor-pointer transition-all hover:shadow-md ${filters.dateRange === "overdue" ? "ring-2 ring-red-500 bg-red-50" : ""}`} onClick={() => handleCardClick("dateRange", "overdue")}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Overdue</p>
                <p className="text-lg font-bold text-red-600">{getOverdueCount()}</p>
              </div>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
          </Card>
        </div>
      </div>

      {/* Main Content - Takes remaining height */}
      <div className={`flex-1 px-8 ${showBulkActions ? "pb-24" : "pb-8"}`}>
        <Card className="h-full flex flex-col shadow-sm">
          <CardHeader className="flex-shrink-0 border-b bg-white">
            <div className="mb-4">
              <CardTitle>All Tickets ({filteredTickets.length})</CardTitle>
              <CardDescription suppressHydrationWarning>
                Showing {startIndex + 1}-{Math.min(endIndex, filteredTickets.length)} of {filteredTickets.length} tickets
              </CardDescription>
            </div>

            {/* Integrated Filters */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input placeholder="Search by client name..." value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} className="pl-10 w-64" />
              </div>

              <Select value={filters.department || "all"} onValueChange={(value) => setFilters((prev) => ({ ...prev, department: value === "all" ? "" : value }))}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.status || "all"} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value === "all" ? "" : value }))}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.priority || "all"} onValueChange={(value) => setFilters((prev) => ({ ...prev, priority: value === "all" ? "" : value }))}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="h-9 px-3">
                  <X className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden">
            {filteredTickets.length === 0 ? (
              <div className="text-center py-8">
                <TicketIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets found</h3>
                <p className="text-gray-600 mb-4">{tickets.length === 0 ? "Create your first ticket to get started." : "Try adjusting your filters to see more results."}</p>
                {tickets.length === 0 && (
                  <Link href="/tickets/create">
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Ticket
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Table Container with Scroll */}
                <div className="flex-1 overflow-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-gray-50 border-b z-10">
                      <tr>
                        <th className="text-left p-3 font-medium text-sm text-gray-700 w-12">
                          <input type="checkbox" checked={selectedTickets.size === currentTickets.length && currentTickets.length > 0} onChange={handleSelectAll} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
                        </th>
                        <th className="text-left p-3 font-medium text-sm text-gray-700">Department</th>
                        <th className="text-left p-3 font-medium text-sm text-gray-700">Type</th>
                        <th className="text-left p-3 font-medium text-sm text-gray-700">Client</th>
                        <th className="text-left p-3 font-medium text-sm text-gray-700">Priority</th>
                        <th className="text-left p-3 font-medium text-sm text-gray-700">Status</th>
                        <th className="text-left p-3 font-medium text-sm text-gray-700">WD</th>
                        <th className="text-left p-3 font-medium text-sm text-gray-700">Created</th>
                        <th className="text-left p-3 font-medium text-sm text-gray-700">Due Date</th>
                        <th className="text-left p-3 font-medium text-sm text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentTickets.map((ticket) => {
                        const overdue = isOverdue(ticket.dueDate) && ticket.status !== "Resolved" && ticket.status !== "Rejected";
                        const hasEdits = ticket.updatedAt.getTime() !== ticket.createdAt.getTime();

                        return (
                          <tr key={ticket.id} className={`hover:bg-gray-50 transition-colors ${overdue ? "bg-red-50" : ""}`}>
                            <td className="p-3">
                              <input type="checkbox" checked={selectedTickets.has(ticket.id)} onChange={() => handleSelectTicket(ticket.id)} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-900">{ticket.department}</span>
                                {hasEdits && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                    Edited
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="text-sm text-gray-900 truncate block max-w-[150px]" title={ticket.ticketType}>
                                {ticket.ticketType}
                              </span>
                            </td>
                            <td className="p-3">
                              {editingTicket === ticket.id && editingField === "clientName" ? (
                                <div className="flex items-center gap-2">
                                  <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={handleKeyPress} onBlur={saveEdit} className="h-7 text-sm" autoFocus />
                                  <Button variant="ghost" size="sm" onClick={saveEdit} className="h-7 w-7 p-0">
                                    <Check className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={cancelEditing} className="h-7 w-7 p-0">
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group">
                                  <span className="text-sm font-medium text-gray-900">{ticket.clientName}</span>
                                  <Button variant="ghost" size="sm" onClick={() => startEditing(ticket.id, "clientName", ticket.clientName)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Edit2 className="w-3 h-3 text-gray-500" />
                                  </Button>
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <Badge className={`${getPriorityColor(ticket.priority)} text-xs`}>{ticket.priority}</Badge>
                            </td>
                            <td className="p-3">
                              {editingTicket === ticket.id && editingField === "status" ? (
                                <div className="flex items-center gap-2">
                                  <Select value={editValue} onValueChange={setEditValue}>
                                    <SelectTrigger className="h-7 text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Open">Open</SelectItem>
                                      <SelectItem value="In Progress">In Progress</SelectItem>
                                      <SelectItem value="Resolved">Resolved</SelectItem>
                                      <SelectItem value="Rejected">Rejected</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button variant="ghost" size="sm" onClick={saveEdit} className="h-7 w-7 p-0">
                                    <Check className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={cancelEditing} className="h-7 w-7 p-0">
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group">
                                  <Badge className={`${getStatusColor(ticket.status)} text-xs`}>{ticket.status}</Badge>
                                  <Button variant="ghost" size="sm" onClick={() => startEditing(ticket.id, "status", ticket.status)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Edit2 className="w-3 h-3 text-gray-500" />
                                  </Button>
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="text-sm text-gray-900 font-mono">{ticket.workingDays}</span>
                            </td>
                            <td className="p-3">
                              <span className="text-sm text-gray-900" suppressHydrationWarning>
                                {formatDate(ticket.createdAt)}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <span className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-gray-900"}`} suppressHydrationWarning>
                                  {formatDate(ticket.dueDate)}
                                </span>
                                {overdue && <AlertTriangle className="w-3 h-3 text-red-500" />}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex gap-1">
                                <Link href={`/ticket?id=${ticket.id}&mode=view`}>
                                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs hover:bg-gray-100">
                                    View
                                  </Button>
                                </Link>
                                <Link href={`/ticket?id=${ticket.id}&mode=edit`}>
                                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs hover:bg-gray-100">
                                    Edit
                                  </Button>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex-shrink-0 flex items-center justify-between p-4 border-t bg-gray-50">
                    <div className="text-sm text-gray-600" suppressHydrationWarning>
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Navigation Bar */}
      {showBulkActions && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 shadow-lg z-50">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <div className="px-3 py-1 bg-gray-700 rounded-full text-sm font-medium" suppressHydrationWarning>
                {selectedTickets.size} selected
              </div>
              <div className="flex items-center gap-3">
                <Select onValueChange={handleBulkUpdateStatus}>
                  <SelectTrigger className="w-40 h-9 bg-gray-800 border-gray-600 text-white">
                    <SelectValue placeholder="Update Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>

                <Popover open={showCalendar} onOpenChange={setShowCalendar}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 bg-gray-800 border-gray-600 text-white hover:bg-gray-700">
                      <Calendar className="w-4 h-4 mr-2" />
                      Push Due Date
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-gray-800 border-gray-600" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate ? new Date(selectedDate) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date.toISOString().split("T")[0]);
                          handleBulkPushDueDate(date.toISOString().split("T")[0]);
                        }
                      }}
                      disabled={(date) => date < new Date()}
                      className="bg-gray-800 text-white"
                    />
                  </PopoverContent>
                </Popover>

                <Button variant="outline" size="sm" onClick={handleBulkDelete} className="h-9 bg-gray-800 border-gray-600 text-red-400 hover:bg-red-900 hover:text-red-300">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={clearSelection} className="h-9 w-9 p-0 text-gray-400 hover:text-white hover:bg-gray-700">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
