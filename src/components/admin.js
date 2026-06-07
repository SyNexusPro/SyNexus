export const ADMIN_EMAIL = "thesynexuspro@gmail.com";

export function isAdminUser(user) {
  return user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
} 