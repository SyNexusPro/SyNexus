type Props = {
  revealed: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** What the field holds, used in labels (“password”, “key”). */
  noun?: string;
};

function cueReveal(): void {
  try {
    navigator.vibrate?.(10);
  } catch {
    /* no haptic on this device */
  }
}

function EyeOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
      />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3l18 18M10.5 6.3C11 6.2 11.5 6 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.2 2.6M6.6 6.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5c1.3 0 2.5-.3 3.6-.8"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M9.9 9.9A2.6 2.6 0 0 0 12 14.6c.4 0 .8-.1 1.1-.2"
      />
    </svg>
  );
}

/**
 * Eye control for password fields. Announces state to assistive tech and
 * offers a short haptic pulse on devices that support it.
 */
export function PasswordRevealToggle({ revealed, onToggle, disabled = false, noun = "password" }: Props) {
  const action = revealed ? `Hide ${noun}` : `Show ${noun}`;
  const hint = revealed
    ? `Hide ${noun}. Currently visible.`
    : `Show ${noun} to confirm what you typed. Currently hidden.`;

  return (
    <span className="password-reveal__control">
      <button
        type="button"
        className="password-reveal__btn password-reveal__btn--icon"
        disabled={disabled}
        aria-pressed={revealed}
        aria-label={action}
        title={hint}
        onClick={() => {
          cueReveal();
          onToggle();
        }}
      >
        {revealed ? <EyeOffIcon /> : <EyeOpenIcon />}
      </button>
      <span className="visually-hidden" aria-live="polite">
        {revealed ? `${noun} visible` : `${noun} hidden`}
      </span>
    </span>
  );
}
