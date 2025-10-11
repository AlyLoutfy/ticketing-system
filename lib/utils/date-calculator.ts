import { addDays, format, isWeekend } from 'date-fns';

/**
 * Calculate working days (excluding weekends)
 * @param startDate - The starting date
 * @param workingDays - Number of working days to add
 * @returns The due date
 */
export function calculateDueDate(startDate: Date, workingDays: number): Date {
  let currentDate = new Date(startDate);
  let daysAdded = 0;
  
  while (daysAdded < workingDays) {
    currentDate = addDays(currentDate, 1);
    
    // Skip weekends (Saturday = 6, Sunday = 0)
    if (!isWeekend(currentDate)) {
      daysAdded++;
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
  return format(date, 'MMM dd, yyyy');
}

/**
 * Format date and time for display
 * @param date - The date to format
 * @returns Formatted date and time string
 */
export function formatDateTime(date: Date): string {
  return format(date, 'MMM dd, yyyy HH:mm');
}

/**
 * Get priority color class
 * @param priority - The priority level
 * @returns Tailwind CSS color class
 */
export function getPriorityColor(priority: string): string {
  switch (priority.toLowerCase()) {
    case 'low':
      return 'bg-green-100 text-green-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'critical':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get status color class
 * @param status - The status
 * @returns Tailwind CSS color class
 */
export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'open':
      return 'bg-blue-100 text-blue-800';
    case 'in progress':
      return 'bg-purple-100 text-purple-800';
    case 'resolved':
      return 'bg-green-100 text-green-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
