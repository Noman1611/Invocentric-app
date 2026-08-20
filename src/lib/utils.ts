import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 1024);
}

export function normalizePhoneNumber(phone: string) {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle leading zero for 10-digit Indian numbers (e.g. 09876543210 -> 9876543210)
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }
  
  // If it is a 10 digit number, prepend India country code 91
  if (cleaned.length === 10) {
    return '91' + cleaned;
  }
  return cleaned;
}

export function getWhatsAppShareUrl(phone?: string, text: string = '') {
  const cleanPhone = phone ? normalizePhoneNumber(phone) : '';
  const encodedText = encodeURIComponent(text);
  
  // Universal WhatsApp redirection link
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

export function getWhatsAppWebUrl(phone?: string, text: string = '') {
  const cleanPhone = phone ? normalizePhoneNumber(phone) : '';
  const encodedText = encodeURIComponent(text);
  if (cleanPhone) {
    return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://web.whatsapp.com/send?text=${encodedText}`;
}

export function getWhatsAppAppUrl(phone?: string, text: string = '') {
  const cleanPhone = phone ? normalizePhoneNumber(phone) : '';
  const encodedText = encodeURIComponent(text);
  if (cleanPhone) {
    return `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `whatsapp://send?text=${encodedText}`;
}

export function formatCurrency(amount: number | null | undefined, currency: string = 'USD') {
  const safeAmount = typeof amount === 'number' ? amount : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(safeAmount);
  } catch (e) {
    return `${currency} ${safeAmount.toFixed(2)}`;
  }
}

export function getInvoiceDisplayNumber(invoice: any): string {
  if (invoice?.invoice_number && String(invoice.invoice_number).trim() !== '') {
    return invoice.invoice_number;
  }
  const dateObj = invoice?.date ? new Date(invoice.date) : (invoice?.created_at ? new Date(invoice.created_at) : new Date());
  const year = !isNaN(dateObj.getFullYear()) ? dateObj.getFullYear() : 2026;
  const idStr = invoice?.id ? String(invoice.id) : '1';
  let hashNum = 1;
  for (let i = 0; i < idStr.length; i++) {
    hashNum = (hashNum * 31 + idStr.charCodeAt(i)) % 9000;
  }
  hashNum = Math.abs(hashNum) + 101;
  return `INV-${year}-${String(hashNum).padStart(4, '0')}`;
}
