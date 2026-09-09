type HeraVoiceControlsProps = {
  listening: boolean;
  supported: boolean;
  partial?: string;
  error?: string | null;
  disabled?: boolean;
  onToggle: () => void;
  label?: string;
};

export function HeraVoiceControls({
  listening,
  supported,
  partial = "",
  error = null,
  disabled = false,
  onToggle,
  label = "Voice",
}: HeraVoiceControlsProps) {
  if (!supported) {
    return (
      <div className="hera-voice-controls hera-voice-controls--unsupported" role="status">
        Voice input isn’t available in this browser. Type your message instead.
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`hera-voice-controls${listening ? " hera-voice-controls--listening" : ""}`}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop listening" : `Start ${label}`}
    >
      <span
        className={`hera-voice-controls__mic${listening ? " hera-voice-controls__mic--on" : ""}`}
        aria-hidden
      >
        <span className="hera-voice-controls__mic-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v4" />
            <path d="M8 22h8" />
          </svg>
        </span>
        {listening ? (
          <span className="hera-voice-controls__wave">
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
        ) : null}
      </span>
      <span className="hera-voice-controls__meta">
        <span className="hera-voice-controls__status">{listening ? "Listening… tap to send" : "Tap to speak"}</span>
        {partial ? <span className="hera-voice-controls__partial">{partial}</span> : null}
        {error ? <span className="hera-voice-controls__error">{error}</span> : null}
      </span>
    </button>
  );
}
