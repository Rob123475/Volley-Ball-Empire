// One-off inspector for a UnityWebData1.0 archive (the .data file Unity's
// WebGL loader fetches). Format: magic string, then a little-endian uint32
// header length, then a flat list of (offset uint32, size uint32,
// nameLen uint32, name bytes) entries covering the whole header region,
// followed by the concatenated file contents at their declared offsets.
const fs = require("fs");
const path = require("path");

const src = process.argv[2];
if (!src) { console.error("usage: node inspect-unity-data.cjs <path-to-.data>"); process.exit(1); }

const fd = fs.openSync(src, "r");
const magicBuf = Buffer.alloc(16);
fs.readSync(fd, magicBuf, 0, 16, 0);
const magic = magicBuf.toString("utf8").replace(/\0+$/, "");
console.log(`Magic: ${JSON.stringify(magic)}`);

const headerLenBuf = Buffer.alloc(4);
fs.readSync(fd, headerLenBuf, 0, 4, 16);
const headerLen = headerLenBuf.readUInt32LE(0);
console.log(`Header length: ${headerLen}`);

const header = Buffer.alloc(headerLen - 20);
fs.readSync(fd, header, 0, header.length, 20);

let pos = 0;
const entries = [];
while (pos < header.length) {
  const offset = header.readUInt32LE(pos); pos += 4;
  const size = header.readUInt32LE(pos); pos += 4;
  const nameLen = header.readUInt32LE(pos); pos += 4;
  const name = header.toString("utf8", pos, pos + nameLen); pos += nameLen;
  entries.push({ offset, size, name });
}

fs.closeSync(fd);

entries.sort((a, b) => b.size - a.size);
const total = entries.reduce((s, e) => s + e.size, 0);

console.log(`\nEntry count: ${entries.length}`);
console.log(`Total entry bytes: ${total} (${(total / 1024 / 1024).toFixed(1)} MB)\n`);

console.log("All entries, largest first:");
for (const e of entries) {
  console.log(`  ${(e.size / 1024 / 1024).toFixed(2).padStart(10)} MB  ${(e.size / total * 100).toFixed(1).padStart(5)}%  ${e.name}`);
}

// Group by extension for a coarser breakdown
const byExt = new Map();
for (const e of entries) {
  const ext = path.extname(e.name) || "(no ext)";
  byExt.set(ext, (byExt.get(ext) || 0) + e.size);
}
console.log("\nBy extension:");
for (const [ext, size] of [...byExt.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${(size / 1024 / 1024).toFixed(2).padStart(10)} MB  ${(size / total * 100).toFixed(1).padStart(5)}%  ${ext}`);
}
