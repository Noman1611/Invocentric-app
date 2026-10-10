import fs from 'fs';
import path from 'path';
import https from 'https';
import dotenv from 'dotenv';

import { execSync } from 'child_process';

dotenv.config();

let TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
if (!TOKEN) {
  try {
    TOKEN = execSync('gh auth token', { encoding: 'utf8' }).trim();
  } catch (e) {
    console.warn('[Release] Could not retrieve token from gh CLI:', e.message);
  }
}
const OWNER = 'Noman1611';
const REPO = 'Invocentric-app';
const TAG = 'v1.0.49';

const RELEASE_TITLE = 'InvoCentric v1.0.49 - High-Performance Startup Boost, In-Memory Decryption Cache & Resilient Offline Data Sync';
const RELEASE_NOTES = `## InvoCentric v1.0.49 Release Notes

### What's New in v1.0.49:
- **Instant Startup & 0ms In-Memory Decryption Cache:**
  - Resolved heavy CPU spikes on app launch by implementing an in-memory decryption cache for AES-256 secure storage.
  - Eliminated UI thread freeze and sluggish scrolling across Desktop, Web, and Android.
- **Resilient Offline Data Preservation:**
  - Patched data sync hooks (\`useInvoices\`, \`useCustomers\`, \`useItems\`, \`usePayments\`, \`useExpenses\`, \`usePurchases\`, \`useNotifications\`, \`useTemplates\`) to safely merge local data with remote snapshots.
  - Fixed cache overwrite bug so existing local and offline records are never erased by empty or unmigrated remote responses.
- **Broadcast Storm Throttle & Safety Timeout:**
  - Added targeted collection filtering to sync events to prevent simultaneous cascading re-renders.
  - Added 1500ms safety timeout to prevent infinite loading spinners under slow or throttled network conditions.
- **Cross-Platform Release Builds:**
  - Freshly compiled Windows Setup (.exe) installer with blockmap.
  - Rebuilt and signed Android production APK (\`InvoCentric.apk\`).
  - Production WebApp bundle.
`;

const ASSETS = [
  {
    filePath: fs.existsSync('dist_electron/latest.yml') ? 'dist_electron/latest.yml' : 'latest.yml',
    name: 'latest.yml',
    contentType: 'text/yaml'
  },
  {
    filePath: 'InvoCentric.apk',
    name: 'InvoCentric.apk',
    contentType: 'application/vnd.android.package-archive'
  },
  {
    filePath: 'dist_electron/InvoCentric-Setup.exe',
    name: 'InvoCentric-Setup.exe',
    contentType: 'application/octet-stream'
  },
  {
    filePath: 'dist_electron/InvoCentric-Setup.exe.blockmap',
    name: 'InvoCentric-Setup.exe.blockmap',
    contentType: 'application/octet-stream'
  }
];

function uploadAssetHttps(uploadUrl, filePath, contentType) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(uploadUrl);
    const stat = fs.statSync(filePath);

    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Authorization': `token ${TOKEN}`,
        'User-Agent': 'InvoCentric-Release-Agent',
        'Content-Type': contentType,
        'Content-Length': stat.size
      },
      timeout: 30 * 60 * 1000 // 30 minutes timeout
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (_) {
            resolve({ ok: true });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Upload socket timed out'));
    });

    const fileStream = fs.createReadStream(filePath);
    let uploadedBytes = 0;
    let lastLogTime = Date.now();

    fileStream.on('data', chunk => {
      uploadedBytes += chunk.length;
      if (Date.now() - lastLogTime > 3000) {
        lastLogTime = Date.now();
        const percent = ((uploadedBytes / stat.size) * 100).toFixed(1);
        process.stdout.write(`   Uploading... ${percent}% (${(uploadedBytes / 1024 / 1024).toFixed(1)} / ${(stat.size / 1024 / 1024).toFixed(1)} MB)\r`);
      }
    });

    fileStream.pipe(req);
  });
}

async function main() {
  console.log(`[Release] Starting GitHub release publication for ${TAG}...`);

  const headers = {
    'Authorization': `token ${TOKEN}`,
    'User-Agent': 'InvoCentric-Release-Agent',
    'Accept': 'application/vnd.github.v3+json'
  };

  // 1. Check if release already exists or create new
  let release = null;
  const existingRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${TAG}`, { headers });
  if (existingRes.ok) {
    release = await existingRes.json();
    console.log(`[Release] Found existing release ${TAG} (ID: ${release.id})`);
  } else {
    console.log(`[Release] Creating new release ${TAG}...`);
    const createRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: TAG,
        target_commitish: 'main',
        name: RELEASE_TITLE,
        body: RELEASE_NOTES,
        draft: false,
        prerelease: false
      })
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create release: HTTP ${createRes.status} - ${errText}`);
    }
    release = await createRes.json();
    console.log(`[Release] Created release ${TAG} (ID: ${release.id})`);
  }

  // 2. Upload assets (latest.yml and InvoCentric.apk first!)
  for (const asset of ASSETS) {
    const absPath = path.resolve(asset.filePath);
    if (!fs.existsSync(absPath)) {
      console.warn(`[Release] File not found: ${absPath}, skipping.`);
      continue;
    }

    const stat = fs.statSync(absPath);
    console.log(`\n[Release] Preparing asset: ${asset.name} (${(stat.size / 1024 / 1024).toFixed(2)} MB)...`);

    // Check if asset already exists in release
    const existingAsset = release.assets?.find(a => a.name === asset.name);
    if (existingAsset) {
      if (existingAsset.size === stat.size && asset.name !== 'InvoCentric.apk') {
        console.log(`✓ [Release] ${asset.name} is already fully uploaded (${(existingAsset.size / 1024 / 1024).toFixed(2)} MB), skipping.`);
        continue;
      }
      console.log(`[Release] Re-uploading asset ${asset.name} (fresh build), deleting old asset (ID: ${existingAsset.id})...`);
      await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/${existingAsset.id}`, {
        method: 'DELETE',
        headers
      });
      console.log(`[Release] Deleted old asset.`);
    }

    const uploadUrl = `https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(asset.name)}`;

    console.log(`[Release] Streaming ${asset.name} to GitHub...`);
    let attempts = 0;
    let uploaded = false;
    while (attempts < 3 && !uploaded) {
      attempts++;
      try {
        if (attempts > 1) {
          console.log(`[Release] Retrying ${asset.name} (Attempt ${attempts}/3)...`);
        }
        const uploadedData = await uploadAssetHttps(uploadUrl, absPath, asset.contentType);
        console.log(`\n✓ [Release] Successfully uploaded ${asset.name}! ${uploadedData?.browser_download_url || ''}`);
        uploaded = true;
      } catch (uploadErr) {
        console.error(`\n[Release] Error uploading ${asset.name} (Attempt ${attempts}/3):`, uploadErr.message);
        if (attempts < 3) {
          console.log(`[Release] Waiting 5 seconds before retry...`);
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }
  }

  // 3. Verify latest release endpoint
  console.log('\n[Release] Verifying latest release endpoint...');
  const latestRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, { headers });
  if (latestRes.ok) {
    const latestData = await latestRes.json();
    console.log(`[Release] Confirmed! Latest release is now: ${latestData.tag_name} (${latestData.name})`);
    console.log('[Release] Available assets:');
    latestData.assets?.forEach(a => {
      console.log(`  - ${a.name} (${(a.size / 1024 / 1024).toFixed(2)} MB): ${a.browser_download_url}`);
    });
  }

  console.log('\n🎉 Publication complete! Both Android and Windows app updaters will now discover v1.0.40.');
}

main().catch(err => {
  console.error('[Release] Fatal Error:', err);
  process.exit(1);
});
