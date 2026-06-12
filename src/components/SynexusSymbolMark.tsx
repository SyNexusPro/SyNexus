type SynexusSymbolMarkProps = {
  className?: string;
  size?: "panel" | "chat";
};

/** Synexus emblem only — cropped from the full logo asset, scaled to fit the box. */
export function SynexusSymbolMark({ className = "", size = "panel" }: SynexusSymbolMarkProps) {
  return (
    <div
      className={`synexus-symbol-box synexus-symbol-box--${size}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <img className="synexus-symbol-box__img" src="/synexus-symbol.png?v=5" alt="" />
    </div>
  );
}
