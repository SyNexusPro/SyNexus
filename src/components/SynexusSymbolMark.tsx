type SynexusSymbolMarkProps = {
  className?: string;
  size?: "panel" | "chat" | "fab";
  /** Kept for API compatibility — logo no longer heartbeats. */
  alive?: boolean;
};

/** SyNexus emblem only — static mark (no heartbeat animation). */
export function SynexusSymbolMark({ className = "", size = "panel" }: SynexusSymbolMarkProps) {
  return (
    <div className={`synexus-symbol-box synexus-symbol-box--${size}${className ? ` ${className}` : ""}`} aria-hidden="true">
      <img className="synexus-symbol-box__img" src="/synexus-symbol.png?v=5" alt="" />
    </div>
  );
}
