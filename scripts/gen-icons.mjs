import sharp from 'sharp';

const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="24" fill="#1e40af"/>
  <text x="96" y="130" font-size="120" font-family="serif" font-weight="bold" fill="white" text-anchor="middle">中</text>
</svg>`;

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="#1e40af"/>
  <text x="256" y="350" font-size="320" font-family="serif" font-weight="bold" fill="white" text-anchor="middle">中</text>
</svg>`;

await sharp(Buffer.from(svg192)).png().toFile('public/pwa-192x192.png');
await sharp(Buffer.from(svg512)).png().toFile('public/pwa-512x512.png');
console.log('PNG icons created: pwa-192x192.png, pwa-512x512.png');
