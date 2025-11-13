import { format, isValid, parseISO } from "date-fns";

export function formatDate(date, formatString = 'MMM d, yyyy') {
  if (!date) return '-';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    if (!isValid(dateObj)) return '-';
    return format(dateObj, formatString);
  } catch (error) {
    console.error('Date formatting error:', error, date);
    return '-';
  }
}

export function formatDateTime(date, formatString = 'MMM d, yyyy h:mm a') {
  return formatDate(date, formatString);
}

export function formatCurrency(value) {
  return (value || 0).toLocaleString('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

// Helper function to convert date input to ISO string without timezone shift
export function dateInputToISO(dateString) {
  if (!dateString) return null;
  // For date inputs (YYYY-MM-DD format), create date at noon UTC to avoid timezone issues
  const date = new Date(dateString + 'T12:00:00.000Z');
  return date.toISOString();
}

// Helper function to convert ISO string back to date input format (YYYY-MM-DD)
export function isoToDateInput(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    // Extract just the date part in local timezone
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Date conversion error:', error, isoString);
    return '';
  }
}