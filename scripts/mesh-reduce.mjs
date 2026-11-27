// 1.2 Part D (28 Nov 2026): cuts a mesh's triangles for Unity's MeshReduce editor tool.
// Rob's Tripo models come out far too dense (the palms 1.9 million triangles each, the drinks
// 64,000), and Unity has no reducer of its own. This uses meshoptimizer's simplifier, which keeps
// UV seams and borders intact, so the model's own texture still fits.
//
//   node scripts/mesh-reduce.mjs IN.bin OUT.bin TARGET_TRIANGLES
//
// IN.bin (little-endian): int32 vertexCount, int32 indexCount, then vertexCount x
// (position xyz, normal xyz, uv xy) as float32, then indexCount uint32 indices.
// OUT.bin: int32 indexCount, then the kept indices (into the same vertices), and the
// simplifier's relative error as float32 last. Unity drops the vertices no index uses.
import { readFileSync, writeFileSync } from "node:fs";
import { MeshoptSimplifier } from "meshoptimizer";

const [inPath, outPath, targetArg] = process.argv.slice(2);
if (!inPath || !outPath || !targetArg) {
  console.error("usage: node scripts/mesh-reduce.mjs IN.bin OUT.bin TARGET_TRIANGLES");
  process.exit(2);
}
await MeshoptSimplifier.ready;

const buf = readFileSync(inPath);
const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const vertexCount = view.getInt32(0, true);
const indexCount = view.getInt32(4, true);
const stride = 8;
const verts = new Float32Array(buf.buffer.slice(buf.byteOffset + 8, buf.byteOffset + 8 + vertexCount * stride * 4));
const indices = new Uint32Array(buf.buffer.slice(buf.byteOffset + 8 + vertexCount * stride * 4, buf.byteOffset + 8 + vertexCount * stride * 4 + indexCount * 4));

const positions = new Float32Array(vertexCount * 3);
const attributes = new Float32Array(vertexCount * 5);
for (let v = 0; v < vertexCount; v++) {
  positions.set(verts.subarray(v * stride, v * stride + 3), v * 3);
  attributes.set(verts.subarray(v * stride + 3, v * stride + 8), v * 5);
}

const target = Math.min(indexCount, Math.max(3, Math.round(Number(targetArg)) * 3));
// Normals weigh a little (keep the silhouette's shading), UVs more (keep the texture on its charts).
const weights = [0.5, 0.5, 0.5, 1, 1];
const [kept, error] = MeshoptSimplifier.simplifyWithAttributes(
  indices, positions, 3, attributes, 5, weights, null, target, 1, ["Permissive"]);
// No error limit: it stops at the target, taking the cheapest cuts first.
const out = Buffer.alloc(4 + kept.length * 4 + 4);
out.writeInt32LE(kept.length, 0);
Buffer.from(kept.buffer, kept.byteOffset, kept.byteLength).copy(out, 4);
out.writeFloatLE(error, 4 + kept.length * 4);
writeFileSync(outPath, out);
console.log(`[mesh-reduce] ${indexCount / 3} -> ${kept.length / 3} triangles (target ${target / 3}), error ${error.toFixed(4)}`);
