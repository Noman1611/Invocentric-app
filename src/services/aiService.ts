import { auth } from '../lib/firebase';

export interface ExtractedInvoice {
  customerName?: string;
  supplierName?: string;
  supplierGst?: string;
  supplierPhone?: string;
  supplierAddress?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  supplierBillNo?: string;
  dueDate?: string;
  subTotal?: number;
  discount?: number;
  taxableAmount?: number;
  cgst?: number;
  sgst?: number;
  roundOff?: number;
  items: Array<{
    description: string;
    hsn?: string;
    barcode?: string;
    batchNo?: string;
    serialNo?: string;
    quantity: number;
    rate?: number;
    price?: number;
    gstPercent?: number;
    amount?: number;
  }>;
  totalAmount?: number;
  currency?: string;
}

export async function extractInvoiceFromImage(base64Image: string, mimeType: string): Promise<ExtractedInvoice> {
  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : '';

    const response = await fetch('/api/extract-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ base64Image, mimeType }),
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMsg = 'Failed to extract data via API server';
      try {
        const errorData = JSON.parse(text);
        errorMsg = errorData.error || errorData.message || errorMsg;
      } catch (e) {
        errorMsg = `Server error (${response.status}): ${text.slice(0, 50)}...`;
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("AI Extraction Error client-side:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to extract data from image. Please try manually.");
  }
}

export interface ParsedContact {
  name?: string;
  phone?: string;
  company_name?: string;
  email?: string;
  address?: string;
  gst_number?: string;
}

export async function parseContactFromText(text: string): Promise<ParsedContact> {
  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : '';

    const response = await fetch('/api/parse-contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMsg = 'Failed to parse contact via API server';
      try {
        const errorData = JSON.parse(text);
        errorMsg = errorData.error || errorData.message || errorMsg;
      } catch (e) {
        errorMsg = `Server error (${response.status}): ${text.slice(0, 50)}...`;
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("AI Parse Error client-side:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to parse contact data.");
  }
}

export interface ExtractedProduct {
  name?: string;
  brand?: string;
  category?: string;
  barcode?: string;
  mrp?: number;
  price?: number;
  wholesalePrice?: number;
  costPrice?: number;
  discount?: number;
  hsn?: string;
  unit?: string;
  size?: string;
  stock?: number;
  serialNumber?: string;
  custom_box?: string;
  gstPercent?: number;
  description?: string;
}

export async function extractProductFromImage(base64Image: string, mimeType: string): Promise<ExtractedProduct> {
  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : '';

    const response = await fetch('/api/extract-product', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ base64Image, mimeType }),
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMsg = 'Failed to extract product data via AI';
      try {
        const errorData = JSON.parse(text);
        errorMsg = errorData.error || errorData.message || errorMsg;
      } catch (e) {
        errorMsg = `Server error (${response.status}): ${text.slice(0, 50)}...`;
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("AI Product Extraction Error client-side:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to extract product details from image.");
  }
}

