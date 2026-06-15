import type { ReactNode } from "react";
import type { Token } from "../data/tokens";
import { logTradeIntent } from "../lib/walletHealth";

type Props = {
  token: Token;
  href: string;
  className?: string;
  side?: "buy" | "sell";
  children: ReactNode;
};

export function TradeIntelBuyLink({ token, href, className, side = "buy", children }: Props) {
  function handleClick() {
    logTradeIntent(token, side);
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
