import DOMPurify from 'dompurify';

export const sanitizeString = (str: string): string => {
  if (!str) return str;
  return DOMPurify.sanitize(str, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }); // Strip all HTML
};

export const sanitizeData = (data: any): any => {
  if (data === undefined) {
    return null;
  }

  if (typeof data === 'string') {
    return sanitizeString(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  
  if (data !== null && typeof data === 'object') {
    const sanitizedObj: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const val = data[key];
        if (val !== undefined) {
          sanitizedObj[key] = sanitizeData(val);
        }
      }
    }
    return sanitizedObj;
  }
  
  return data;
};
