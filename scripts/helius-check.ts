/**
 * Local connection check. Prints status only. The key stays in the environment.
 */
import { probeHelius } from "../lib/server/helius/client.js";

const result = await probeHelius(process.env);
console.log(JSON.stringify({
  configured: result.configured,
  ok: result.ok,
  slot: result.slot,
  reason: result.reason,
}));
process.exit(result.ok ? 0 : 1);
