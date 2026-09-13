import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { packageAllLocalData } from './fileSystemDb';

const GDRIVE_TOKEN_KEY = 'invocentric_gdrive_access_token';
const GDRIVE_ENABLED_KEY = 'invocentric_gdrive_backup_enabled';
const GDRIVE_LAST_BACKUP_KEY = 'invocentric_gdrive_last_backup';

export interface GDriveSyncResult {
  success: boolean;
  masterFileId?: string;
  dailyFileId?: string;
  folderId?: string;
  error?: string;
}

export function isGoogleDriveConnected(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem(GDRIVE_ENABLED_KEY) === 'true' && localStorage.getItem(GDRIVE_TOKEN_KEY));
}

export function getGoogleDriveLastBackupTime(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(GDRIVE_LAST_BACKUP_KEY);
}

export function disconnectGoogleDrive() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GDRIVE_TOKEN_KEY);
  localStorage.removeItem(GDRIVE_ENABLED_KEY);
  localStorage.removeItem(GDRIVE_LAST_BACKUP_KEY);
  window.dispatchEvent(new CustomEvent('gdrive_status_changed', { detail: { connected: false } }));
}

/**
 * Connect to Google Drive by requesting drive.file OAuth scope
 */
export async function connectGoogleDrive(): Promise<string> {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    provider.setCustomParameters({ prompt: 'consent' });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error("Could not acquire Google Drive access token.");
    }

    localStorage.setItem(GDRIVE_TOKEN_KEY, token);
    localStorage.setItem(GDRIVE_ENABLED_KEY, 'true');
    window.dispatchEvent(new CustomEvent('gdrive_status_changed', { detail: { connected: true } }));
    return token;
  } catch (error: any) {
    console.error("Error connecting Google Drive:", error);
    throw error;
  }
}

/**
 * Search or create a folder on Google Drive
 */
async function getOrCreateFolder(folderName: string, parentId?: string, token?: string): Promise<string> {
  const queryParts = [
    `name = '${folderName}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false"
  ];
  if (parentId) {
    queryParts.push(`'${parentId}' in parents`);
  }

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(queryParts.join(' and '))}&fields=files(id,name)`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create folder
  const createMeta: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId) {
    createMeta.parents = [parentId];
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createMeta)
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create folder '${folderName}' on Google Drive.`);
  }

  const created = await createRes.json();
  return created.id;
}

/**
 * Upload or update a file in Google Drive
 */
async function uploadOrUpdateFile(
  fileName: string,
  content: string,
  folderId: string,
  token: string,
  alwaysCreateNew = false
): Promise<string> {
  let fileId: string | null = null;

  if (!alwaysCreateNew) {
    // Check if file already exists in folder
    const q = `name = '${fileName}' and '${folderId}' in parents and trashed = false`;
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        fileId = data.files[0].id;
      }
    }
  }

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    ...(alwaysCreateNew || !fileId ? { parents: [folderId] } : {})
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    content +
    closeDelim;

  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const method = fileId ? 'PATCH' : 'POST';

  const uploadRes = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Failed to upload file '${fileName}': ${errText}`);
  }

  const result = await uploadRes.json();
  return result.id;
}

/**
 * Performs full sync to Google Drive:
 * 1. Master accumulation file: /InvoCentic_Backups/invocentric_master_backup.json
 * 2. Daily dated file: /InvoCentic_Backups/daily_backups/backup_YYYY-MM-DD.json
 */
export async function syncDataToGoogleDrive(userId: string): Promise<GDriveSyncResult> {
  if (!userId) {
    return { success: false, error: 'User ID is required' };
  }

  let token = localStorage.getItem(GDRIVE_TOKEN_KEY);
  if (!token) {
    return { success: false, error: 'Google Drive is not connected. Please connect Google Drive first.' };
  }

  try {
    const data = packageAllLocalData(userId);
    const jsonStr = JSON.stringify(data, null, 2);
    const today = new Date().toISOString().split('T')[0];

    // 1. Root InvoCentic Backups Folder
    const rootFolderId = await getOrCreateFolder('InvoCentic_Backups', undefined, token);

    // 2. Upload / Update Master File
    const masterFileId = await uploadOrUpdateFile('invocentric_master_backup.json', jsonStr, rootFolderId, token, false);

    // 3. Daily Backups Folder
    const dailyFolderId = await getOrCreateFolder('daily_backups', rootFolderId, token);

    // 4. Upload Today's Dated Backup File
    const dailyFileName = `backup_${today}.json`;
    const dailyFileId = await uploadOrUpdateFile(dailyFileName, jsonStr, dailyFolderId, token, false);

    // Update timestamp
    const nowIso = new Date().toISOString();
    localStorage.setItem(GDRIVE_LAST_BACKUP_KEY, nowIso);
    window.dispatchEvent(new CustomEvent('gdrive_backup_success', { detail: { timestamp: nowIso } }));

    return {
      success: true,
      masterFileId,
      dailyFileId,
      folderId: rootFolderId
    };
  } catch (err: any) {
    console.error("Google Drive sync failed:", err);
    // If token expired (401), mark for reconnect
    if (String(err?.message || '').includes('401') || String(err?.message || '').includes('Invalid Credentials')) {
      disconnectGoogleDrive();
      return { success: false, error: 'Google Drive session expired. Please reconnect your account.' };
    }
    return { success: false, error: err?.message || 'Google Drive sync failed' };
  }
}
