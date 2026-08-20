import { useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getSecureStorage, setSecureStorage } from '../utils/cryptoUtils';
import { parseDateSafe } from '../utils/dateUtils';

export default function AutoBackup() {
  const { user } = useAuth();

  const performBackup = useCallback(async (userData: any) => {
    try {
      console.log("Starting auto-backup process...");
      
      // 1. Fetch all invoices for this user from local storage
      const invoices = getSecureStorage(`offline_invoices_${user?.uid}`, []);
      
      if (invoices.length === 0) {
        console.log("No invoices found for backup.");
        return;
      }

      // 2. Generate CSV
      const headers = ['ID', 'Invoice Number', 'Amount', 'Currency', 'Status', 'Date'];
      const rows = invoices.map((inv: any) => [
        inv.id,
        inv.invoice_number || '',
        inv.amount || 0,
        inv.currency || 'INR',
        inv.status || 'draft',
        inv.created_at ? parseDateSafe(inv.created_at).toLocaleDateString() : ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      // 3. Send via API
      const token = user ? await user.getIdToken() : '';
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          to: userData.email || user?.email,
          subject: `Daily Backup: InvoCentric Invoices (${new Date().toLocaleDateString()})`,
          html: `
            <div style="font-family: sans-serif; padding: 20px;">
              <h2>Daily Invoice Backup</h2>
              <p>Attached is your daily backup of all invoices from InvoCentric.</p>
              <p>Total Invoices: ${invoices.length}</p>
              <hr />
              <p style="color: #666; font-size: 12px;">This is an automated security feature of InvoCentric.</p>
            </div>
          `,
          attachments: [
            {
              filename: `invocentric_backup_${new Date().toISOString().split('T')[0]}.csv`,
              content: btoa(unescape(encodeURIComponent(csvContent)))
            }
          ]
        })
      });

      if (response.ok) {
        console.log("Backup email sent successfully.");
        // 4. Update last_backup_at locally
        const profileKey = `user_profile_${user?.uid}`;
        const currentProfile = getSecureStorage(profileKey, {}) || {};
        currentProfile.last_backup_at = new Date().toISOString();
        setSecureStorage(profileKey, currentProfile);
        window.dispatchEvent(new StorageEvent('storage', { key: profileKey, newValue: JSON.stringify(currentProfile) }));
      }
    } catch (error) {
      console.error("Backup failed:", error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const checkBackupStatus = async () => {
      try {
        if (!user) return;
        const userData = getSecureStorage(`user_profile_${user.uid}`, null);
        if (userData) {
          if (userData.backup_enabled) {
            const lastBackup = userData.last_backup_at ? parseDateSafe(userData.last_backup_at) : new Date(0);
            const now = new Date();
            const hoursSinceLastBackup = (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60);

            if (hoursSinceLastBackup >= 24) {
              await performBackup(userData);
            }
          }
        }
      } catch (error) {
        console.error("Error checking backup status:", error);
      }
    };

    checkBackupStatus();
  }, [user, performBackup]);

  return null; // Silent component
}
