/** Pulse: show Aegis, Pulse, Titan, Cipher (no “Sentinel …” prefix). */
export function pulseSentinelDisplayName(fullName: string) {
  return fullName.startsWith("Sentinel ") ? fullName.slice("Sentinel ".length) : fullName;
}

/** Shorten agent names inside generated brief strings. */
export function pulseFormatSentinelNamesInText(text: string) {
  return text
    .replace(/Sentinel Aegis/g, "Aegis")
    .replace(/Sentinel Pulse/g, "Pulse")
    .replace(/Sentinel Titan/g, "Titan")
    .replace(/Sentinel Cipher/g, "Cipher");
}
