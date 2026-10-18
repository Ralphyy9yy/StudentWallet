// Source artwork is vector SVG. PNGs are deterministic build assets for Expo.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "assets/branding/wallet.svg"),
  "utf8",
);
const foreground = source.replace(
  '<rect width="1024" height="1024" rx="224" fill="#166534"/>',
  "",
);
async function render(svg, name, size) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path.join(root, "assets/branding", name));
}
async function main() {
  await render(source, "icon.png", 1024);
  await render(foreground, "adaptive-foreground.png", 1024);
  await render(source, "splash.png", 512);
  const mono = foreground
    .replace(/fill="#[A-Fa-f0-9]+"/g, 'fill="#FFFFFF"')
    .replace(/stroke="#[A-Fa-f0-9]+"/g, 'stroke="#FFFFFF"');
  await render(mono, "monochrome.png", 1024);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
