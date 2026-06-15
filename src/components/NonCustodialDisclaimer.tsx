type Props = {
  className?: string;
};

export function NonCustodialDisclaimer({ className = "" }: Props) {
  return (
    <aside
      className={`non-custodial-disclaimer ${className}`.trim()}
      role="note"
      aria-label="Non-custodial disclaimer"
    >
      <p className="non-custodial-disclaimer__title">You control your funds</p>
      <p className="non-custodial-disclaimer__body">
        Synexus is <strong>non-custodial</strong>. We never hold your SOL, tokens, or seed phrase. Every swap
        is initiated by you and signed in your wallet (Phantom, Solflare, Backpack, etc.). Synexus provides
        intelligence and shortcuts — not custody, brokerage, or investment advice.
      </p>
    </aside>
  );
}
