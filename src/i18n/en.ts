/** Flat UI chrome keys — expand packs as pages adopt t(). */
export const en = {
  "nav.primary": "Primary",
  "nav.account": "Account",
  "nav.login": "Login",
  "nav.scan": "Scan",
  "nav.hub": "Hub",
  "nav.titan": "Titan",

  "footer.about": "About",
  "footer.trust": "Trust",
  "footer.contact": "Contact",
  "footer.hub": "Hub",
  "footer.faq": "FAQ",
  "footer.pricing": "Pricing",
  "footer.blog": "Blog",
  "footer.disclaimer": "Disclaimer",
  "footer.terms": "Terms",
  "footer.privacy": "Privacy",
  "footer.deleteData": "Delete data",
  "footer.deleteAccount": "Delete account",
  "footer.refunds": "Refunds",
  "footer.language": "Language",

  "lang.auto": "Auto (device)",
  "lang.label": "Language",
  "lang.search": "Search languages…",
  "lang.applied": "Language updated",

  "common.loading": "Loading…",
  "common.error": "Something went wrong. Try again.",
  "common.close": "Close",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.back": "Back",
  "common.continue": "Continue",
  "common.signedIn": "You're signed in.",
  "common.pro": "Pro",
  "common.free": "Free",

  "accountDeletion.title": "Delete your SyNexus account",
  "accountDeletion.summary":
    "Request deletion of your Operator account and related personal data. To delete data without closing your account, use data deletion instead.",
  "accountDeletion.dataLink": "data deletion",
  "accountDeletion.howTitle": "How to request deletion",
  "accountDeletion.emailLabel": "Account email",
  "accountDeletion.confirm":
    "I want this SyNexus account and associated personal data deleted. I understand this cannot be undone once completed.",
  "accountDeletion.submit": "Request account deletion",
  "accountDeletion.busy": "Preparing request…",

  "dataDeletion.title": "Request data deletion",
  "dataDeletion.summary":
    "Ask us to delete some or all personal data without closing your Operator account.",
  "dataDeletion.clearLocal": "Clear local data on this device",
  "dataDeletion.submit": "Request data deletion (keep account)",
  "dataDeletion.accountLink": "Delete entire account",

  "whale.toastTitle": "Whale buy · Leviathan",
  "whale.openToken": "Open token →",

  "titan.placeholder": "Ask Titan anything…",
  "titan.thinking": "Thinking…",
} as const;

export type MessageKey = keyof typeof en;
export type MessageCatalog = Record<MessageKey, string>;
