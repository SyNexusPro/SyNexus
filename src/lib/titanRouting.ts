/** Messages handled instantly by the crypto brain (scans, Sentinel status). Everything else → LLM. */
export function isInstantTitanPath(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (/^(search|find|scan|look up|lookup)\b/.test(lower)) return true;
  if (/sentinel|aegis|pulse|leviathan|cipher/.test(lower) && /status|report|doing|orders?/.test(lower)) {
    return true;
  }
  if (/how many|list.*coin|all coin|every coin|tokens/.test(lower)) return true;
  return false;
}
