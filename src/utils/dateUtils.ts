import { format, parseISO } from 'date-fns';

export const parseDateSafe = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (typeof dateVal === 'string') {
    try {
      return parseISO(dateVal);
    } catch (e) {
      return new Date();
    }
  }
  if (dateVal.toDate && typeof dateVal.toDate === 'function') {
    return dateVal.toDate();
  }
  if (dateVal.seconds) {
    return new Date(dateVal.seconds * 1000);
  }
  if (dateVal instanceof Date) {
    return dateVal;
  }
  if (typeof dateVal === 'number') {
    return new Date(dateVal);
  }
  return new Date();
};

export const formatDateSafe = (dateVal: any, fmt: string) => {
  if (!dateVal) return 'N/A';
  try {
    const d = parseDateSafe(dateVal);
    return format(d, fmt);
  } catch (e) {
    return 'Invalid Date';
  }
};

export const getRelativeTimeString = (dateVal: any): string => {
  if (!dateVal) return 'just now';
  try {
    const date = parseDateSafe(dateVal);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    if (diffMs < 0) return 'just now';
    
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return 'just now';
    
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return format(date, 'MMM d, yyyy');
  } catch (e) {
    return 'just now';
  }
};
