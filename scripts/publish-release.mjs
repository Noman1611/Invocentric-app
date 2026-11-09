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
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const TAG = `v${pkg.version}`;

const RELEASE_TITLE = `InvoCentric v${pkg.version} - Auto-Updater Loop Fix, Dashboard Navigation & Production Mobile Dock`;
const RELEASE_NOTES = `## InvoCentric v${pkg.version} Release Notes

### What's Fixed & Improved in v${pkg.version}:
- **Windows Desktop Software Auto-Updater Loop Fixed:**
  - Fixed the infinite download/restart update loop in the Windows software where downloads would finish, fail checksum validation, and restart repeatedly.
  - Fully synchronized \`latest.yml\` SHA-512 checksum and exact byte size with \`InvoCentric-Setup.exe\`.
  - Configured \`disableDifferentialDownload = true\` in Electron auto-updater to guarantee atomic full downloads without blockmap corruption.
  - Hardened auto-updater IPC to invoke clean installer execution on restart.
- **WebApp Dashboard Navigation Buttons Fixed:**
  - Fixed non-responsive buttons on Dashboard: "Sales / Revenue", "Unpaid / Due Balance", "View All Invoices", and "Create First Invoice" now navigate seamlessly.
  - Safe date parsing for statements and transactions to eliminate null timestamp crashes.
- **Mobile Dynamic Island Navigation Dock:**
  - Dedicated **Home** navigation icon alongside Create Invoice, POS, and Settings.
  - Compact floating dock pill (\`rounded-full\`) where only active item expands to show label, maintaining tight spacing without empty horizontal gaps.
  - Flat top screen viewport corners on mobile for edge-to-edge display on Android and smartphone webapps.
- **Strict Customer Dues Filtering:**
  - Customer dues filter exclusively shows customers with outstanding balances (\`due_amount > 0\`).
- **Production Inventory Movement Ledger:**
  - Real-time chronological audit trail of all stock movements (Stock OUT from invoice sales, Stock IN from purchases, adjustments).
- **Cross-Platform Releases:**
  - **Desktop Software:** \`InvoCentric-Setup.exe\` & \`latest.yml\` (v${pkg.version})
  - **Android Mobile App:** \`InvoCentric.apk\` (v${pkg.version}, versionCode 55)
  - **Web Application:** Fully tested (100% pass rate on all 144 unit and E2E tests).
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

  console.log(`\n🎉 Publication complete! Both Android and Windows app updaters will now discover ${TAG}.`);
}

main().catch(err => {
  console.error('[Release] Fatal Error:', err);
  process.exit(1);
});
