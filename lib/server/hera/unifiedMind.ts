/**
 * One Hera. Personal notes stay with the person who consented.
 * Shared lessons are general, de-identified, and stay unverified until the owner approves them.
 */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const PHONE = /\b(?:\+?\d{1,2}[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/;
const SECRET = /\b(?:sk-|sk_|eyJ|bearer\s|seed phrase|private key|password)\b/i;
const WALLET = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
const PERSONAL = /\b(?:my name is|i am|i'm|i live|my wife|my husband|my kid|my address|my phone|my email|my wallet)\b/i;

export const HERA_ONE_IDENTITY =
  "You are one Hera for every person on SyNexus. A new conversation is not a new Hera. " +
  "Private memory belongs only to the signed-in person it was shared with, and it follows that same account across their devices. " +
  "Shared lessons are general and were approved before you use them. If a memory or lesson is missing, say you do not have it. Never invent a personal history, and never describe one person's private life to anyone else.";

export function containsPrivateDetail(text: string): boolean {
  return EMAIL.test(text) || UUID.test(text) || PHONE.test(text) || SECRET.test(text) || WALLET.test(text);
}

export function personalNoteFromUtterance(text: string): string | null {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length < 12 || cleaned.length > 280) return null;
  if (containsPrivateDetail(cleaned)) return null;
  if (!/^(?:please remember|remember that|i prefer|i like|i don't like|i do not like)\b/i.test(cleaned)) return null;
  return cleaned;
}

export function proposeSharedLesson(text: string): { ok: true; lesson: string } | { ok: false; reason: string } {
  const lesson = text.replace(/\s+/g, " ").trim().slice(0, 400);
  if (lesson.length < 24) return { ok: false, reason: "too_short" };
  if (containsPrivateDetail(lesson) || PERSONAL.test(lesson)) return { ok: false, reason: "private" };
  return { ok: true, lesson };
}

export function formatHeraMind(input: {
  personalConsent: boolean;
  personalNotes: string[];
  sharedLessons: string[];
  memoryAvailable: boolean;
}): string {
  const personal = input.personalConsent
    ? input.personalNotes.length
      ? input.personalNotes.map((note) => `- ${note}`).join("\n")
      : "- This person allowed memory, and nothing has been saved yet."
    : "- This person has not allowed personal memory. Do not guess their preferences.";
  const shared = input.sharedLessons.length
    ? input.sharedLessons.map((lesson) => `- ${lesson}`).join("\n")
    : "- No approved shared lesson applies.";
  const availability = input.memoryAvailable
    ? ""
    : "The memory store could not be read. Say that memory is unavailable instead of filling the gap.\n";
  return `${HERA_ONE_IDENTITY}\n${availability}PRIVATE MEMORY FOR THIS PERSON ONLY:\n${personal}\nAPPROVED SHARED LESSONS (general, not personal):\n${shared}`;
}

export function canApproveSharedLesson(owner: boolean): boolean {
  return owner === true;
}
