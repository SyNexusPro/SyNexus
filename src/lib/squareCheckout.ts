export type StartProCheckoutInput = {
  userId?: string | null;
  email?: string | null;
};

export type StartProCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string; needsSignIn?: boolean };

export async function startProCheckout(
  input: StartProCheckoutInput = {},
): Promise<StartProCheckoutResult> {
  const userId = input.userId?.trim();
  const email = input.email?.trim();

  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plan: "PRO",
      userId: userId || undefined,
      email: email || undefined,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };

  if (!response.ok || !data.url) {
    return {
      ok: false,
      error:
        data.error ||
        (response.status === 503
          ? "Checkout is not configured on the server yet. Try again shortly."
          : "Checkout could not be opened. Please try again."),
    };
  }

  return { ok: true, url: data.url };
}

export function redirectToProCheckout(url: string) {
  window.location.href = url;
}
