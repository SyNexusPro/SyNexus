#!/usr/bin/env node
/**
 * Generate VAPID keys for Web Push whale alerts.
 *   node scripts/generate-vapid.mjs
 * Paste into .env + Vercel: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("\nWeb Push VAPID keys\n══════════════════");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:thesynexus@synexus.pro");
console.log("\nAlso set HELIUS_WEBHOOK_SECRET + WHALE_TRACK_MINTS for ingest.\n");
