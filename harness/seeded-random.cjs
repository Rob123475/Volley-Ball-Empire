/**
 * Preload for a harness server: Math.random becomes a seeded generator
 * (mulberry32), so two servers given the same seed and the same requests make
 * the same draws. Used where a suite must show two paths through the game do
 * EXACTLY the same work (F-1: Next match vs the day-by-day clock); any
 * difference in the calls either path makes shows up as a different result.
 *
 * Seed from VBE_RANDOM_SEED. Loaded with `--require`, never shipped.
 */
"use strict";
let a = Number(process.env.VBE_RANDOM_SEED ?? 1) >>> 0;
Math.random = function seededRandom() {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
