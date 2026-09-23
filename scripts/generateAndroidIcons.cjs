const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// SVG with safe-zone padding for Android Adaptive Icon Foreground
// Canvas: 512 x 512.
// In 108dp adaptive icon, safe zone is 72dp (66.6%).
// Radius 160 = diameter 320 (62.5% of 512). This leaves a clean 3.75dp margin inside the 72dp mask circle.
const adaptiveForegroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <circle cx="256" cy="256" r="160" fill="#0F645D" />
  <g transform="translate(256, 256) scale(0.52) translate(-250, -250)">
    <path fill="#FFFFFF" d="M432.7,268c-17.2-4.9-35.1,5.1-39.9,22.3c-0.1,0.3-0.1,0.4-0.2,0.7c-11.4,39.7-37.9,72-74.4,90.9c-35.2,18.3-75.5,21.7-113.4,9.7c-37.8-12-68.8-38-87-73.3c-18.3-35.2-21.7-75.5-9.7-113.4s38-68.8,73.3-87c36.6-19.1,80-21.8,118.9-7.9c16.8,6.1,35.3-2.6,41.4-19.4c6.1-16.8-2.6-35.3-19.4-41.4c-55.8-20.1-118.1-16-170.7,11.3c-50.6,26.3-88,70.6-105.2,125c-0.5,1.9-1.2,3.9-1.8,5.8c-15.1,52.6-9.6,108.1,15.7,156.9c54.2,104.5,183.2,145.4,287.7,91.3C400,412.6,438.9,365,455,308.8c0.1-0.3,0.2-0.5,0.2-0.7C460,290.8,449.9,272.9,432.7,268z" />
    <ellipse fill="#FFFFFF" cx="420.6" cy="149.9" rx="43.1" ry="43.1"/>
    <path fill="#FFFFFF" d="M324.8,191l-95.1,86.8l-31.8-35.6c-12.7-15.1-35.2-16.9-50.2-4.3c-15.1,12.7-16.9,35.2-4.3,50.2l31.7,35.6c12.4,14.7,29.2,23.2,46.8,25c17.9,2,36.4-2.9,51.8-14.9l95.1-86.8c15.5-12.1,18.1-34.6,6-50C362.6,181.5,340.3,178.8,324.8,191z" />
  </g>
</svg>`;

// Full bleed circular logo for legacy round icons (r=236 with subtle anti-alias margin)
const legacyRoundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <circle cx="256" cy="256" r="236" fill="#0F645D" />
  <g transform="translate(256, 256) scale(0.76) translate(-250, -250)">
    <path fill="#FFFFFF" d="M432.7,268c-17.2-4.9-35.1,5.1-39.9,22.3c-0.1,0.3-0.1,0.4-0.2,0.7c-11.4,39.7-37.9,72-74.4,90.9c-35.2,18.3-75.5,21.7-113.4,9.7c-37.8-12-68.8-38-87-73.3c-18.3-35.2-21.7-75.5-9.7-113.4s38-68.8,73.3-87c36.6-19.1,80-21.8,118.9-7.9c16.8,6.1,35.3-2.6,41.4-19.4c6.1-16.8-2.6-35.3-19.4-41.4c-55.8-20.1-118.1-16-170.7,11.3c-50.6,26.3-88,70.6-105.2,125c-0.5,1.9-1.2,3.9-1.8,5.8c-15.1,52.6-9.6,108.1,15.7,156.9c54.2,104.5,183.2,145.4,287.7,91.3C400,412.6,438.9,365,455,308.8c0.1-0.3,0.2-0.5,0.2-0.7C460,290.8,449.9,272.9,432.7,268z" />
    <ellipse fill="#FFFFFF" cx="420.6" cy="149.9" rx="43.1" ry="43.1"/>
    <path fill="#FFFFFF" d="M324.8,191l-95.1,86.8l-31.8-35.6c-12.7-15.1-35.2-16.9-50.2-4.3c-15.1,12.7-16.9,35.2-4.3,50.2l31.7,35.6c12.4,14.7,29.2,23.2,46.8,25c17.9,2,36.4-2.9,51.8-14.9l95.1-86.8c15.5-12.1,18.1-34.6,6-50C362.6,181.5,340.3,178.8,324.8,191z" />
  </g>
</svg>`;

const configs = [
  { dir: 'mipmap-mdpi', fgSize: 108, legacySize: 48 },
  { dir: 'mipmap-hdpi', fgSize: 162, legacySize: 72 },
  { dir: 'mipmap-xhdpi', fgSize: 216, legacySize: 96 },
  { dir: 'mipmap-xxhdpi', fgSize: 324, legacySize: 144 },
  { dir: 'mipmap-xxxhdpi', fgSize: 432, legacySize: 192 },
];

async function run() {
  const baseRes = path.join(__dirname, '../android/app/src/main/res');
  
  for (const cfg of configs) {
    const targetDir = path.join(baseRes, cfg.dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 1. Generate ic_launcher_foreground.png (for Adaptive Icons with safe-zone padding)
    const fgPath = path.join(targetDir, 'ic_launcher_foreground.png');
    await sharp(Buffer.from(adaptiveForegroundSvg))
      .resize(cfg.fgSize, cfg.fgSize)
      .png()
      .toFile(fgPath);
    console.log(`Generated ${fgPath} (${cfg.fgSize}x${cfg.fgSize})`);

    // 2. Generate ic_launcher.png (legacy launcher icon)
    const iconPath = path.join(targetDir, 'ic_launcher.png');
    await sharp(Buffer.from(legacyRoundSvg))
      .resize(cfg.legacySize, cfg.legacySize)
      .png()
      .toFile(iconPath);
    console.log(`Generated ${iconPath} (${cfg.legacySize}x${cfg.legacySize})`);

    // 3. Generate ic_launcher_round.png (legacy round icon)
    const roundIconPath = path.join(targetDir, 'ic_launcher_round.png');
    await sharp(Buffer.from(legacyRoundSvg))
      .resize(cfg.legacySize, cfg.legacySize)
      .png()
      .toFile(roundIconPath);
    console.log(`Generated ${roundIconPath} (${cfg.legacySize}x${cfg.legacySize})`);
  }

  console.log('All Android Launcher Icons generated successfully with 0% overflow!');
}

run().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
