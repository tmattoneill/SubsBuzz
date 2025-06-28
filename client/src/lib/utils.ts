import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return format(date, 'EEEE, MMMM d, yyyy');
}

export function formatTime(date: Date | string): string {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return format(date, 'h:mm a');
}

export function getSenderInitials(email: string): string {
  const parts = email.split('@')[0].split(/[._-]/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function getSenderName(email: string): string {
  return email.split('@')[0].replace(/[._-]/g, ' ');
}

export function getSenderIcon(email: string): string {
  const domain = email.split('@')[1]?.split('.')[0];
  
  if (!domain) return '';
  
  const firstChar = domain.charAt(0).toUpperCase();
  return firstChar;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function getTopicColors(topic: string): { bg: string, text: string } {
  const topics: Record<string, { bg: string, text: string }> = {
    'Technology': { bg: 'bg-blue-100', text: 'text-primary' },
    'AI': { bg: 'bg-purple-100', text: 'text-purple-600' },
    'Innovation': { bg: 'bg-green-100', text: 'text-green-600' },
    'Business': { bg: 'bg-gray-100', text: 'text-gray-600' },
    'Politics': { bg: 'bg-red-100', text: 'text-red-600' },
    'Climate': { bg: 'bg-emerald-100', text: 'text-emerald-600' },
    'Finance': { bg: 'bg-amber-100', text: 'text-amber-600' },
    'Marketing': { bg: 'bg-orange-100', text: 'text-orange-600' },
    'Advertising': { bg: 'bg-blue-100', text: 'text-primary' },
    'Privacy': { bg: 'bg-red-100', text: 'text-red-600' },
    'Policy': { bg: 'bg-blue-100', text: 'text-blue-600' },
    'International': { bg: 'bg-gray-100', text: 'text-gray-600' }
  };

  return topics[topic] || { bg: 'bg-gray-100', text: 'text-gray-600' };
}
