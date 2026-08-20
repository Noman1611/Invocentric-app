import { useEffect, useRef } from 'react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { sendEmail, emailTemplates } from '../services/emailService';
import { useAuth } from '../contexts/AuthContext';
import { useInvoices } from './useData';
import { isBefore } from 'date-fns';
import { parseDateSafe } from '../utils/dateUtils';
import { formatCurrency } from '../lib/utils';

export function useAutoReminders() {
  const { user, isOfflineMode } = useAuth();
  const { invoices, loading } = useInvoices();
  const checkRef = useRef(false);

  useEffect(() => {
    async function checkReminders() {
      if (!user || loading || checkRef.current || isOfflineMode) return;
      checkRef.current = true;

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists() || !userSnap.data()?.reminders_enabled) return;
        const userData = userSnap.data();
        
        const now = new Date();
        
        const invoicesToRemind = invoices.filter(inv => {
          if (inv.status !== 'sent') return false;
          const dueDate = inv.due_date ? parseDateSafe(inv.due_date) : new Date();
          if (!isBefore(dueDate, now)) return false;
          
          if (inv.last_reminded_at) {
            const lastReminded = parseDateSafe(inv.last_reminded_at);
            const diffDays = Math.floor((now.getTime() - lastReminded.getTime()) / (1000 * 3600 * 24));
            return diffDays >= 7;
          }
          return true;
        });

        for (const invoice of invoicesToRemind) {
          const custDocRef = doc(db, 'customers', invoice.customer_id);
          const custSnap = await getDoc(custDocRef);
          
          if (custSnap.exists()) {
            const customerData = custSnap.data();
            if (customerData.email) {
              const template = emailTemplates.overdueReminder(
                customerData.name,
                userData.business_name || 'Business Pro',
                formatCurrency(invoice.amount, invoice.currency),
                `${window.location.origin}/invoices/${invoice.id}`
              );

              await sendEmail({
                to: customerData.email,
                ...template
              });

              await updateDoc(doc(db, 'invoices', invoice.id), {
                status: 'overdue',
                last_reminded_at: new Date().toISOString(), // Use iso string for date-fns compatibility
                updated_at: serverTimestamp()
              });
            }
          }
        }
      } catch (error) {
        console.error("Reminder process failed:", error);
        handleFirestoreError(error, OperationType.GET, 'users/reminders');
      }
    }

    if (!loading && user) {
      checkReminders();
    }
  }, [loading, user, invoices]);
}
