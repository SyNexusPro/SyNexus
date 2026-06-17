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
      aria-label="Experience level"
    >
      {!compact ? (
        <div className="ui-mode-toggle__intro">
          <span className="ui-mode-toggle__label">Experience</span>
          <span className="ui-mode-toggle__hint">Easy for beginners · Advanced for power users</span>
        </div>
      ) : null}
      <div className="ui-mode-toggle__track">
        <span
          className="ui-mode-toggle__glow"
          aria-hidden
          data-active={mode}
        />
        <button
          type="button"
          className={mode === "simple" ? "is-active" : ""}
          aria-pressed={mode === "simple"}
          onClick={() => select("simple")}
        >
          <span className="ui-mode-toggle__icon" aria-hidden>
            ◎
          </span>
          Easy
        </button>
        <button
          type="button"
          className={mode === "advanced" ? "is-active" : ""}
          aria-pressed={mode === "advanced"}
          onClick={() => select("advanced")}
        >
          <span className="ui-mode-toggle__icon" aria-hidden>
            ⧉
          </span>
          Advanced
        </button>
      </div>
    </div>
  );
}
