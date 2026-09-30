export const RECOVERY_CODE_LENGTH = 6;

export const PASSWORD_RECOVERY_SUCCESS = "Password successfully changed. You can now sign in.";

export function normalizeRecoveryEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/\D/g, "").slice(0, RECOVERY_CODE_LENGTH);
}

export function passwordRecoveryInboxMessage(email: string): string {
  return `We emailed a ${RECOVERY_CODE_LENGTH}-digit recovery code to ${normalizeRecoveryEmail(
    email,
  )}. Enter it below with your new password — check spam if it has not arrived yet.`;
}
