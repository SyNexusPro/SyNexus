import { useState, type ButtonHTMLAttributes } from "react";
import { getCurrentUser } from "../lib/supabaseData";
import { redirectToProCheckout, startProCheckout } from "../lib/squareCheckout";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  busyLabel?: string;
  onCheckoutError?: (message: string) => void;
};

/** One-click Synexus Pro subscribe — opens Square checkout (sign-in optional). */
export function SynexusSubscribeButton({
  label,
  busyLabel = "Opening…",
  onCheckoutError,
  disabled,
  onClick,
  ...rest
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    if (event.defaultPrevented || busy) return;

    setBusy(true);
    try {
      const user = await getCurrentUser().catch(() => null);
      const checkout = await startProCheckout({
        userId: user?.id,
        email: user?.email ?? undefined,
      });
      if (!checkout.ok) {
        onCheckoutError?.(checkout.error);
        return;
      }
      redirectToProCheckout(checkout.url);
    } catch {
      onCheckoutError?.("Checkout could not be opened. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" {...rest} disabled={disabled || busy} onClick={(e) => void handleClick(e)}>
      {busy ? busyLabel : label}
    </button>
  );
}
