import { addDays, isWeekend } from "date-fns";

/**
 * Calculate working days (excluding weekends)
 * @param startDate - The starting date
 * @param workingDays - Number of working days to add
 * @returns The due date
 */
export function calculateDueDate(startDate: Date, workingDays: number): Date {
  let currentDate = new Date(startDate);
  let daysAdded = 0;

  // Start counting from the next day
  currentDate = addDays(currentDate, 1);

  while (daysAdded < workingDays) {
    // Skip weekends (Saturday = 6, Sunday = 0)
    if (!isWeekend(currentDate)) {
      daysAdded++;
    }

    // Move to next day only if we haven't reached the required working days
    if (daysAdded < workingDays) {
      currentDate = addDays(currentDate, 1);
    }
  }

  return currentDate;
}

/**
 * Calculate working days between two dates
 * @param startDate - The starting date
 * @param endDate - The ending date
 * @returns Number of working days
 */
export function calculateWorkingDaysBetween(startDate: Date, endDate: Date): number {
  let workingDays = 0;
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    if (!isWeekend(currentDate)) {
      workingDays++;
    }
    currentDate = addDays(currentDate, 1);
  }

  return workingDays;
}

/**
 * Check if a date is overdue
 * @param dueDate - The due date
 * @returns True if overdue
 */
export function isOverdue(dueDate: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  return due < today;
}

/**
 * Get days until due date
 * @param dueDate - The due date
 * @returns Number of days (negative if overdue)
 */
export function getDaysUntilDue(dueDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format date for display
 * @param date - The date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  // Use deterministic formatting to avoid hydration mismatch
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[date.getMonth()];
  const day = date.getDate().toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}

/**
 * Format date and time for display
 * @param date - The date to format
 * @returns Formatted date and time string
 */
export function formatDateTime(date: Date): string {
  // Use deterministic formatting to avoid hydration mismatch
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[date.getMonth()];
  const day = date.getDate().toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${month} ${day}, ${year} ${hours}:${minutes}`;
}

/**
 * Get priority color class
 * @param priority - The priority level
 * @returns Tailwind CSS color class
 */
export function getPriorityColor(priority: string): "default" | "secondary" | "destructive" | "outline" {
  switch (priority.toLowerCase()) {
    case "low":
      return "outline";
    case "medium":
      return "secondary";
    case "high":
      return "default";
    case "critical":
      return "destructive";
    default:
      return "outline";
  }
}

/**
 * Get status color class
 * @param status - The status
 * @returns Tailwind CSS color class
 */
export function getStatusColor(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toLowerCase()) {
    case "open":
      return "default";
    case "in progress":
      return "secondary";
    case "resolved":
      return "default";
    case "rejected":
      return "destructive";
    case "overdue":
      return "destructive";
    default:
      return "outline";
  }
}
