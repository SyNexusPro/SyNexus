import { isSuspiciousAuthPassword } from "./securityBot/patterns";

export type PasswordCheck = {
  ok: boolean;
  message?: string;
  score: 0 | 1 | 2 | 3;
};

/** Client-side signup gate — Supabase enforces server rules too. */
export function validateSignupPassword(password: string): PasswordCheck {
  if (!password) {
    return { ok: false, message: "Choose a password.", score: 0 };
  }
  if (password.length < 10) {
    return { ok: false, message: "Use at least 10 characters.", score: 0 };
  }
  if (password.length > 128) {
    return { ok: false, message: "Password is too long.", score: 0 };
  }
  if (isSuspiciousAuthPassword(password)) {
    return { ok: false, message: "Password contains disallowed characters.", score: 0 };
  }

  let score = 1;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!hasLower || !hasDigit) {
    return {
      ok: false,
      message: "Include at least one letter and one number.",
      score: 1,
    };
  }

  if (hasUpper) score += 1;
  if (hasSymbol) score += 1;

  return { ok: true, score: Math.min(3, score) as PasswordCheck["score"] };
}

export function passwordStrengthLabel(score: PasswordCheck["score"]): string {
  switch (score) {
    case 3:
      return "Strong";
    case 2:
      return "Good";
    case 1:
      return "Fair";
    default:
      return "";
  }
}
