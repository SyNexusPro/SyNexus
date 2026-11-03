/**
 * Promptfoo provider. It does not call a model.
 * Unsafe instructions are BLOCKED. Ordinary questions are ALLOWED.
 */
import { guardTitanServerMessage } from "../lib/server/titan/sanitize.ts";

export default class HeraGuardProvider {
  id(): string {
    return "hera-guard";
  }

  async callApi(prompt: string): Promise<{ output: string }> {
    const result = guardTitanServerMessage(prompt);
    return { output: result.ok ? "ALLOWED" : "BLOCKED" };
  }
}
