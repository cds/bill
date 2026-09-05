export { cn } from 'cn';

/**
 * Format a number as Indian Rupee currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date string for display
 */
export function formatDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Format a date as YYYY-MM-DD for input fields
 */
export function toDateInputValue(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date();
  return date.toISOString().split('T')[0];
}

/**
 * Generate a unique temporary ID for client-side use
 */
export function tempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
