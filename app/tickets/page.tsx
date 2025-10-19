"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { storage, Ticket, Department } from "@/lib/storage";
import { formatDate, isOverdue, getDaysUntilDue } from "@/lib/utils/date-calculator";
import { SLADisplay } from "@/components/ui/sla-display";
import { Plus, Search, Filter, Edit, Eye, Calendar, AlertTriangle, Trash2 } from "lucide-react";
import Link from "next/link";

// Helper function to check if text is truncated
const isTextTruncated = (text: string, maxWidth: number) => {
  // Rough estimation: average character width is about 8px, so we calculate approximate width
  const estimatedWidth = text.length * 8;
  return estimatedWidth > maxWidth;
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        await storage.init();
        const [ticketsData, departmentsData] = await Promise.all([storage.getTickets(), storage.getDepartments()]);
        setTickets(ticketsData);
        setDepartments(departmentsData);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch = ticket.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || ticket.ticketType.toLowerCase().includes(searchTerm.toLowerCase()) || (ticket.description && ticket.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = !statusFilter || statusFilter === "all" || ticket.status === statusFilter;
    const matchesDepartment = !departmentFilter || departmentFilter === "all" || ticket.department === departmentFilter;
    return matchesSearch && matchesStatus && matchesDepartment;
  });

  const handleDeleteTicket = async (ticketId: string) => {
    if (confirm("Are you sure you want to delete this ticket?")) {
      try {
        await storage.deleteTicket(ticketId);
        setTickets(tickets.filter((t) => t.id !== ticketId));
      } catch (error) {
        console.error("Error deleting ticket:", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading tickets...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Tickets</h1>
            <p className="text-gray-600 mt-2">Manage and track all tickets</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Admin
              </Button>
            </Link>
            <Link href="/tickets/create">
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Create Ticket
              </Button>
            </Link>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" suppressHydrationWarning>
                {tickets.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tickets.filter((t) => t.status === "Open").length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Edit className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tickets.filter((t) => t.status === "In Progress").length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tickets.filter((t) => t.status === "Resolved").length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter tickets by various criteria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input placeholder="Search tickets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Department</label>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tickets Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Tickets <span suppressHydrationWarning>({filteredTickets.length})</span>
            </CardTitle>
            <CardDescription suppressHydrationWarning>
              Showing {filteredTickets.length} of {tickets.length} tickets
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTickets.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets found</h3>
                <p className="text-gray-600 mb-4" suppressHydrationWarning>
                  {tickets.length === 0 ? "Get started by creating your first ticket." : "Try adjusting your filters to see more results."}
                </p>
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Client Name</TableHead>
                      <TableHead className="w-48">Ticket Type</TableHead>
                      <TableHead className="w-32">Status</TableHead>
                      <TableHead className="w-32">Priority</TableHead>
                      <TableHead className="w-32">SLA</TableHead>
                      <TableHead className="w-32">Days Left</TableHead>
                      <TableHead className="w-32">Created</TableHead>
                      <TableHead className="w-32">Due Date</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.map((ticket) => {
                      const overdue = isOverdue(ticket.dueDate);
                      const daysLeft = getDaysUntilDue(ticket.dueDate);

                      return (
                        <TableRow key={ticket.id}>
                          <TableCell>
                            {isTextTruncated(ticket.clientName, 200) ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="truncate block max-w-[200px]">{ticket.clientName}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{ticket.clientName}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="truncate block max-w-[200px]">{ticket.clientName}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isTextTruncated(ticket.ticketType, 200) ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="truncate block max-w-[200px]">{ticket.ticketType}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{ticket.ticketType}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="truncate block max-w-[200px]">{ticket.ticketType}</span>
                            )}
                          </TableCell>
                          <TableCell>
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
                          </TableCell>
                          <TableCell>
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
                          </TableCell>
                          <TableCell>
                            <SLADisplay sla={ticket.sla} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {ticket.status === "Resolved" ? (
                                <>
                                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                  <span className="text-sm font-medium text-green-600">Resolved</span>
                                </>
                              ) : (
                                <>
                                  <div className={`w-2 h-2 rounded-full ${daysLeft < 0 ? "bg-red-500" : daysLeft <= 1 ? "bg-orange-500" : daysLeft <= 3 ? "bg-yellow-500" : "bg-green-500"}`}></div>
                                  <span className={`text-sm font-medium ${daysLeft < 0 ? "text-red-600" : daysLeft <= 1 ? "text-orange-600" : daysLeft <= 3 ? "text-yellow-600" : "text-green-600"}`}>{daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}</span>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-900" suppressHydrationWarning>
                              {formatDate(ticket.createdAt)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-gray-900"}`} suppressHydrationWarning>
                                {formatDate(ticket.dueDate)}
                              </span>
                              {overdue && <AlertTriangle className="w-4 h-4 text-red-500" />}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Link href={`/ticket/${ticket.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </Link>
                              <Link href={`/ticket/${ticket.id}/edit`}>
                                <Button variant="ghost" size="sm">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </Link>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteTicket(ticket.id)} className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
