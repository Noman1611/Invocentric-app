import fs from 'fs';
import path from 'path';
import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.GITHUB_TOKEN || '';
const OWNER = 'Noman1611';
const REPO = 'Invocentric-app';
const TAG = 'test-channel';

const RELEASE_TITLE = 'InvoCentric Test / Beta Channel';
const RELEASE_NOTES = `## InvoCentric Internal Test & Beta Channel
This is the dedicated testing release channel for InvoCentric mobile & desktop builds.
- **Test APK:** \`InvoCentric-Test.apk\`
- **Purpose:** Test new features & fixes before pushing them to the public production app.
- **In-App Updates:** When installed, this app automatically checks this test channel for subsequent test updates.
`;

const ASSETS = [
  {
    filePath: 'InvoCentric-Test.apk',
    name: 'InvoCentric-Test.apk',
    contentType: 'application/vnd.android.package-archive'
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
      timeout: 30 * 60 * 1000 // 30 mins
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
  if (!TOKEN) {
    throw new Error('GITHUB_TOKEN not found in environment or .env!');
  }

  console.log(`[Test-Channel] Starting publication for tag '${TAG}'...`);

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
    console.log(`[Test-Channel] Found existing release for '${TAG}' (ID: ${release.id})`);
  } else {
    console.log(`[Test-Channel] Creating new release for '${TAG}'...`);
    const createRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: TAG,
        target_commitish: 'main',
        name: RELEASE_TITLE,
        body: RELEASE_NOTES,
        draft: false,
        prerelease: true
      })
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create release: HTTP ${createRes.status} - ${errText}`);
    }
    release = await createRes.json();
    console.log(`[Test-Channel] Created release '${TAG}' (ID: ${release.id})`);
  }

  // 2. Upload assets
  for (const asset of ASSETS) {
    const absPath = path.resolve(asset.filePath);
    if (!fs.existsSync(absPath)) {
      console.warn(`[Test-Channel] File not found: ${absPath}, skipping.`);
      continue;
    }

    const stat = fs.statSync(absPath);
    console.log(`\n[Test-Channel] Preparing asset: ${asset.name} (${(stat.size / 1024 / 1024).toFixed(2)} MB)...`);

    // Delete existing asset if any
    const existingAsset = release.assets?.find(a => a.name === asset.name);
    if (existingAsset) {
      console.log(`[Test-Channel] Deleting older asset ${asset.name} (ID: ${existingAsset.id})...`);
      await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/${existingAsset.id}`, {
        method: 'DELETE',
        headers
      });
      console.log(`[Test-Channel] Deleted older asset.`);
    }

    const uploadUrl = `https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(asset.name)}`;

    console.log(`[Test-Channel] Streaming ${asset.name} to GitHub...`);
    let attempts = 0;
    let uploaded = false;
    while (attempts < 3 && !uploaded) {
      attempts++;
      try {
        if (attempts > 1) {
          console.log(`[Test-Channel] Retrying ${asset.name} (Attempt ${attempts}/3)...`);
        }
        const uploadedData = await uploadAssetHttps(uploadUrl, absPath, asset.contentType);
        console.log(`\n✓ [Test-Channel] Successfully uploaded ${asset.name}!`);
        console.log(`   Download Link: ${uploadedData?.browser_download_url || `https://github.com/${OWNER}/${REPO}/releases/download/${TAG}/${asset.name}`}`);
        uploaded = true;
      } catch (uploadErr) {
        console.error(`\n[Test-Channel] Error uploading ${asset.name} (Attempt ${attempts}/3):`, uploadErr.message);
        if (attempts < 3) {
          console.log(`[Test-Channel] Waiting 5 seconds before retry...`);
          await new Promise(r => setTimeout(r, 5000));
        } else {
          throw uploadErr;
        }
      }
    }
  }

  console.log(`\n🎉 [Test-Channel] Publication complete! Direct download URL:`);
  console.log(`https://github.com/${OWNER}/${REPO}/releases/download/${TAG}/InvoCentric-Test.apk`);
}

main().catch(err => {
  console.error('[Test-Channel Fatal Error]:', err);
  process.exit(1);
});
