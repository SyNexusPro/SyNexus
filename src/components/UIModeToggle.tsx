import { useSynexusUIMode, type SynexusUIMode } from "../hooks/useSynexusUIMode";

type Props = {
  compact?: boolean;
  className?: string;
};

export function UIModeToggle({ compact = false, className = "" }: Props) {
  const { mode, setMode } = useSynexusUIMode();

  function select(next: SynexusUIMode) {
    if (next !== mode) setMode(next);
  }

  return (
    <div
      className={`ui-mode-toggle${compact ? " ui-mode-toggle--compact" : ""}${className ? ` ${className}` : ""}`}
      role="group"
      aria-label="Interface mode"
    >
      {!compact ? <span className="ui-mode-toggle__label">Mode</span> : null}
      <button
        type="button"
        className={mode === "simple" ? "is-active" : ""}
        aria-pressed={mode === "simple"}
        onClick={() => select("simple")}
      >
        Simple
      </button>
      <button
        type="button"
        className={mode === "advanced" ? "is-active" : ""}
        aria-pressed={mode === "advanced"}
        onClick={() => select("advanced")}
      >
        Advanced
      </button>
    </div>
  );
}
