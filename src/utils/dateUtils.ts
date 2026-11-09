import { format, parseISO } from 'date-fns';

export const parseDateSafe = (dateVal: any): Date => {
  if (!dateVal) return new Date();

  let result: Date | null = null;

  if (dateVal instanceof Date) {
    result = dateVal;
  } else if (dateVal.toDate && typeof dateVal.toDate === 'function') {
    try {
      result = dateVal.toDate();
    } catch (_) {}
  } else if (typeof dateVal === 'number') {
    result = new Date(dateVal);
  } else if (dateVal.seconds) {
    result = new Date(dateVal.seconds * 1000);
  } else if (typeof dateVal === 'string') {
    try {
      const parsedIso = parseISO(dateVal);
      if (!isNaN(parsedIso.getTime())) {
        result = parsedIso;
      }
    } catch (_) {}

    if (!result || isNaN(result.getTime())) {
      try {
        const nativeParsed = new Date(dateVal);
        if (!isNaN(nativeParsed.getTime())) {
          result = nativeParsed;
        }
      } catch (_) {}
    }
  }

  if (result && !isNaN(result.getTime())) {
    return result;
  }
  return new Date();
};

export const formatDateSafe = (dateVal: any, fmt: string) => {
  if (!dateVal) return 'N/A';
  try {
    const d = parseDateSafe(dateVal);
    if (isNaN(d.getTime())) return 'N/A';
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
