import { useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getStoredUserProfile, saveStoredUserProfile } from '../utils/settingsStorage';
import { parseDateSafe } from '../utils/dateUtils';
import { isGoogleDriveConnected, syncDataToGoogleDrive, getGoogleDriveLastBackupTime } from '../utils/googleDriveSync';
import { getDirectoryHandleFromIndexedDB, writeAllDataToPcDirectory, packageAllLocalData } from '../utils/fileSystemDb';
import { apiUrl } from '../utils/apiConfig';

export default function AutoBackup() {
  const { user } = useAuth();

  const performEmailBackup = useCallback(async (userData: any) => {
    if (!user) return;
    try {
      console.log("Starting auto-backup email dispatch...");
      const fullData = packageAllLocalData(user.uid);
      const invoices = fullData.invoices || [];

      if (invoices.length === 0) {
        console.log("No invoices found for email backup.");
        return;
      }

      // Generate CSV
      const headers = ['ID', 'Invoice Number', 'Customer', 'Amount', 'Currency', 'Status', 'Date'];
      const rows = invoices.map((inv: any) => [
        inv.id,
        inv.invoice_number || '',
        inv.customer_name || '',
        inv.amount || 0,
        inv.currency || 'INR',
        inv.status || 'draft',
        inv.created_at ? parseDateSafe(inv.created_at).toLocaleDateString() : ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const token = user ? await user.getIdToken() : '';
      const response = await fetch(apiUrl('/api/send-email'), {
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
              <p>Attached is your daily automated backup of all invoices from InvoCentric.</p>
              <p>Total Invoices: ${invoices.length}</p>
              <hr />
              <p style="color: #666; font-size: 12px;">Automated backup triggered every 24 hours.</p>
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
        const nowIso = new Date().toISOString();
        saveStoredUserProfile(user.uid, { last_backup_at: nowIso });
      }
    } catch (error) {
      console.error("Email backup failed:", error);
    }
  }, [user]);

  const performGoogleDriveBackup = useCallback(async () => {
    if (!user || !isGoogleDriveConnected()) return;
    try {
      console.log("Starting Google Drive auto-backup (Master + Daily folder)...");
      const res = await syncDataToGoogleDrive(user.uid);
      if (res.success) {
        console.log("Google Drive auto-backup succeeded:", res);
      } else {
        console.warn("Google Drive auto-backup failed:", res.error);
      }
    } catch (err) {
      console.error("Google Drive auto-backup exception:", err);
    }
  }, [user]);

  const performPcDirectoryBackup = useCallback(async () => {
    if (!user) return;
    try {
      const dirHandle = await getDirectoryHandleFromIndexedDB(user.uid);
      if (!dirHandle) return;

      console.log("Starting PC Hard Drive directory auto-backup (Master + Daily folder)...");
      await writeAllDataToPcDirectory(user.uid, dirHandle);
      console.log("PC Hard Drive directory auto-backup complete.");
    } catch (err) {
      console.warn("PC Hard Drive auto-backup skipped or needs user permission:", err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const checkBackupStatus = async () => {
      try {
        const userData = getStoredUserProfile(user.uid);
        const now = new Date();

        // 1. Check Email Backup (24h)
        if (userData && userData.backup_enabled) {
          const lastBackup = userData.last_backup_at ? parseDateSafe(userData.last_backup_at) : new Date(0);
          const hoursSinceLastBackup = (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60);

          if (hoursSinceLastBackup >= 24) {
            await performEmailBackup(userData);
          }
        }

        // 2. Check Google Drive Backup (24h)
        if (isGoogleDriveConnected()) {
          const gdriveLast = getGoogleDriveLastBackupTime();
          const lastGdriveDate = gdriveLast ? parseDateSafe(gdriveLast) : new Date(0);
          const hoursGdrive = (now.getTime() - lastGdriveDate.getTime()) / (1000 * 60 * 60);

          if (hoursGdrive >= 24) {
            await performGoogleDriveBackup();
          }
        }

        // 3. Check PC Directory Backup (24h)
        const lastPcDir = localStorage.getItem(`pc_directory_last_backup_${user.uid}`);
        const lastPcDate = lastPcDir ? parseDateSafe(lastPcDir) : new Date(0);
        const hoursPc = (now.getTime() - lastPcDate.getTime()) / (1000 * 60 * 60);

        if (hoursPc >= 24) {
          await performPcDirectoryBackup();
        }
      } catch (error) {
        console.error("Error checking auto-backup status:", error);
      }
    };

    // Run check 3 seconds after mount so it doesn't block initial rendering
    const timer = setTimeout(checkBackupStatus, 3000);
    return () => clearTimeout(timer);
  }, [user, performEmailBackup, performGoogleDriveBackup, performPcDirectoryBackup]);

  return null; // Silent background runner
}
