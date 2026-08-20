import { sanitizeString } from '../utils/sanitizeUtils';
import { auth } from '../lib/firebase';

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  attachments?: {
    filename: string;
    content: string; // Base64
  }[];
}

export async function sendEmail(data: EmailRequest) {
  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : '';

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to send email');
    }

    return await response.json();
  } catch (error) {
    console.error('Email service error:', error);
    throw error;
  }
}

export const emailTemplates = {
  invoiceSent: (customerName: string, bizName: string, amount: string, invoiceUrl: string) => ({
    subject: `New Invoice from ${sanitizeString(bizName)}`,
    html: `
      <h2>Hello ${sanitizeString(customerName)},</h2>
      <p>A new invoice has been generated for you by <strong>${sanitizeString(bizName)}</strong>.</p>
      <p>Amount Due: <strong>${amount}</strong></p>
      <p>You can view and download your invoice here:</p>
      <a href="${invoiceUrl}" style="padding: 10px 20px; background: #000; color: #fff; text-decoration: none; border-radius: 5px;">View Invoice</a>
      <p>Thank you for your business!</p>
    `
  }),
  paymentReceived: (customerName: string, bizName: string, amount: string) => ({
    subject: `Payment Received - Thank You!`,
    html: `
      <h2>Payment Confirmed</h2>
      <p>Hi ${sanitizeString(customerName)},</p>
      <p>We've received your payment of <strong>${amount}</strong> for your recent invoice from <strong>${sanitizeString(bizName)}</strong>.</p>
      <p>Thank you for the prompt payment!</p>
    `
  }),
  overdueReminder: (customerName: string, bizName: string, amount: string, invoiceUrl: string, dueDate: string = 'Today', invoiceNumber: string = '001') => ({
    subject: `Payment Reminder: Invoice #${invoiceNumber} Due - ${sanitizeString(bizName)}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', Helvetica, Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #0D635D 0%, #115e59 100%); padding: 32px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
          .content { padding: 40px 32px; color: #334155; }
          .invoice-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
          .label { color: #64748b; font-weight: 500; }
          .value { color: #0f172a; font-weight: 700; }
          .amount-highlight { font-size: 28px; font-weight: 900; color: #0D635D; margin: 16px 0; text-align: center; }
          .btn-container { text-align: center; margin: 32px 0 16px; }
          .btn { background-color: #0D635D; color: #ffffff !important; padding: 14px 32px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(13, 99, 93, 0.3); }
          .footer { background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Reminder</h1>
            <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">From ${sanitizeString(bizName)}</p>
          </div>
          <div class="content">
            <p style="font-size: 16px; margin-top: 0;">Hi <strong>${sanitizeString(customerName)}</strong>,</p>
            <p>This is a friendly reminder that invoice <strong>#${sanitizeString(invoiceNumber)}</strong> is currently pending settlement.</p>
            
            <div class="invoice-box">
              <div class="row"><span class="label">Invoice Number:</span> <span class="value">#${sanitizeString(invoiceNumber)}</span></div>
              <div class="row"><span class="label">Due Date:</span> <span class="value">${dueDate}</span></div>
              <div class="amount-highlight">${amount}</div>
            </div>

            <p style="font-size: 14px; color: #475569; text-align: center;">Please settle this amount at your earliest convenience to maintain uninterrupted service.</p>

            <div class="btn-container">
              <a href="${invoiceUrl}" class="btn">View & Pay Invoice</a>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0;">Powered by <strong>InvoCentric</strong> — Free GST Invoicing & Billing Platform</p>
            <p style="margin: 8px 0 0;">If you have already paid this invoice, please disregard this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};
