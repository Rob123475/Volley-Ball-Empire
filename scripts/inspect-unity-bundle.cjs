// Digs one level deeper than inspect-unity-data.cjs: parses the UnityFS
// AssetBundle embedded as "data.unity3d" inside the UnityWebData archive,
// decompresses its LZ4-block-compressed directory ("blocks info"), and lists
// the individual files packed inside (sharedassets*.resS, level*, streaming
// assets, etc.) with sizes - the actual texture/audio/mesh breakdown.
const fs = require("fs");

const src = process.argv[2];
if (!src) { console.error("usage: node inspect-unity-bundle.cjs <path-to-.data>"); process.exit(1); }

function readCStr(b, off) {
  let end = off;
  while (b[end] !== 0) end++;
  return [b.toString("utf8", off, end), end + 1];
}

// Raw LZ4 block decompression (no frame format) - see lz4_Block_format.md.
function lz4Decompress(input, outputSize) {
  const out = Buffer.alloc(outputSize);
  let ip = 0, op = 0;
  while (op < outputSize) {
    const token = input[ip++];
    let literalLength = token >> 4;
    if (literalLength === 15) {
      let b;
      do { b = input[ip++]; literalLength += b; } while (b === 255);
    }
    input.copy(out, op, ip, ip + literalLength);
    ip += literalLength;
    op += literalLength;
    if (op >= outputSize) break;

    const matchOffset = input.readUInt16LE(ip); ip += 2;
    let matchLength = token & 0x0f;
    if (matchLength === 15) {
      let b;
      do { b = input[ip++]; matchLength += b; } while (b === 255);
    }
    matchLength += 4;
    let matchPos = op - matchOffset;
    for (let i = 0; i < matchLength; i++) {
      out[op++] = out[matchPos++];
    }
  }
  return out;
}

// --- Locate data.unity3d inside the outer UnityWebData1.0 archive ---
const fd = fs.openSync(src, "r");
const headerLenBuf = Buffer.alloc(4);
fs.readSync(fd, headerLenBuf, 0, 4, 16);
const headerLen = headerLenBuf.readUInt32LE(0);
const outerHeader = Buffer.alloc(headerLen - 20);
fs.readSync(fd, outerHeader, 0, outerHeader.length, 20);
let pos = 0; const outerEntries = [];
while (pos < outerHeader.length) {
  const offset = outerHeader.readUInt32LE(pos); pos += 4;
  const size = outerHeader.readUInt32LE(pos); pos += 4;
  const nameLen = outerHeader.readUInt32LE(pos); pos += 4;
  const name = outerHeader.toString("utf8", pos, pos + nameLen); pos += nameLen;
  outerEntries.push({ offset, size, name });
}
const bundleEntry = outerEntries.find(e => e.name === "data.unity3d");
const base = bundleEntry.offset;

// --- Parse the UnityFS header ---
const head = Buffer.alloc(4096);
fs.readSync(fd, head, 0, 4096, base);

let p = 0;
const [sig, p1] = readCStr(head, p); p = p1;
const version = head.readUInt32BE(p); p += 4;
const [unityVersion, p2] = readCStr(head, p); p = p2;
const [unityRevision, p3] = readCStr(head, p); p = p3;
const bundleSize = head.readBigInt64BE(p); p += 8;
const compressedBlocksInfoSize = head.readUInt32BE(p); p += 4;
const uncompressedBlocksInfoSize = head.readUInt32BE(p); p += 4;
const flags = head.readUInt32BE(p); p += 4;
const headerEnd = p;

console.log({ sig, unityRevision, bundleSize: bundleSize.toString(), compressedBlocksInfoSize, uncompressedBlocksInfoSize, flags });

const compressionType = flags & 0x3f;
const blocksInfoAtEnd = !!(flags & 0x80);
const needsPaddingAtStart = !!(flags & 0x200);
console.log("compressionType:", compressionType, "blocksInfoAtEnd:", blocksInfoAtEnd, "needsPaddingAtStart:", needsPaddingAtStart);

// Read the compressed blocksInfo blob - immediately follows the header when
// not "at end" (the common case for the flags seen here).
let blocksInfoOffset;
if (blocksInfoAtEnd) {
  blocksInfoOffset = base + Number(bundleSize) - compressedBlocksInfoSize;
} else {
  blocksInfoOffset = base + headerEnd;
  if (needsPaddingAtStart) blocksInfoOffset = (blocksInfoOffset + 15) & ~15;
}
const compressedBlocksInfo = Buffer.alloc(compressedBlocksInfoSize);
fs.readSync(fd, compressedBlocksInfo, 0, compressedBlocksInfoSize, blocksInfoOffset);
fs.closeSync(fd);

let blocksInfo;
if (compressionType === 0) {
  blocksInfo = compressedBlocksInfo;
} else if (compressionType === 2 || compressionType === 3) {
  blocksInfo = lz4Decompress(compressedBlocksInfo, uncompressedBlocksInfoSize);
} else {
  console.error("Unsupported blocksInfo compression type:", compressionType, "(LZMA not implemented here)");
  process.exit(1);
}

// --- Parse the decompressed blocksInfo: uncompressedDataHash(16 bytes),
// blockCount + per-block (uncompressedSize, compressedSize, flags), then
// nodeCount + per-node (offset int64, size int64, flags uint32, path cstr).
let bp = 16; // skip 16-byte hash
const blockCount = blocksInfo.readUInt32BE(bp); bp += 4;
for (let i = 0; i < blockCount; i++) {
  bp += 4 + 4 + 2; // uncompressedSize(4) + compressedSize(4) + flags(2)
}
const nodeCount = blocksInfo.readUInt32BE(bp); bp += 4;
const nodes = [];
for (let i = 0; i < nodeCount; i++) {
  const nodeOffset = blocksInfo.readBigInt64BE(bp); bp += 8;
  const nodeSize = blocksInfo.readBigInt64BE(bp); bp += 8;
  const nodeFlags = blocksInfo.readUInt32BE(bp); bp += 4;
  const [nodePath, bpNext] = readCStr(blocksInfo, bp); bp = bpNext;
  nodes.push({ offset: nodeOffset, size: nodeSize, path: nodePath });
}

nodes.sort((a, b) => (b.size > a.size ? 1 : -1));
const total = nodes.reduce((s, n) => s + n.size, 0n);
console.log(`\nInternal AssetBundle contents (${nodes.length} entries, ${(Number(total) / 1024 / 1024).toFixed(1)} MB total):`);
for (const n of nodes) {
  const mb = Number(n.size) / 1024 / 1024;
  const pct = Number(n.size) * 100 / Number(total);
  console.log(`  ${mb.toFixed(2).padStart(10)} MB  ${pct.toFixed(1).padStart(5)}%  ${n.path}`);
}
