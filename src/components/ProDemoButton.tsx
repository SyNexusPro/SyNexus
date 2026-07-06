import { useNavigate } from "react-router-dom";
import { SYNEXUS_PRO_TRIAL_LABEL } from "../config/proTrial";
import { useProDemo } from "../hooks/useProDemo";
import { useOperatorAuth } from "../hooks/useOperatorAuth";
import { useSynexusPlan } from "../hooks/useSynexusPlan";
import { useTitanBotName } from "../hooks/useTitanBotName";
import { openOracleLogin } from "../lib/openOracleLogin";

type Props = {
  className?: string;
  /** Navigate to Pulse after starting (default true for home hero). */
  goToPulse?: boolean;
  pulseHash?: string;
  label?: string;
  disabled?: boolean;
};

export function ProDemoButton({
  className = "pulse-demo-button",
  goToPulse = false,
  pulseHash = "",
  label = `Start ${SYNEXUS_PRO_TRIAL_LABEL}`,
  disabled = false,
}: Props) {
  const navigate = useNavigate();
  const plan = useSynexusPlan();
  const { linked } = useOperatorAuth();
  const { name: titanBotName } = useTitanBotName();
  const { active, remainingLabel, beginDemo } = useProDemo();

  if (plan === "PRO" && !active) return null;

  function handleClick() {
    if (!linked) {
      openOracleLogin();
      return;
    }
    if (active) {
      if (goToPulse) navigate(`/pulse${pulseHash}`);
      return;
    }
    beginDemo();
    if (goToPulse) navigate(`/pulse${pulseHash}`);
  }

  const displayLabel = !linked
    ? `Enter ${titanBotName}`
    : active
      ? `Pro trial · ${remainingLabel}`
      : label;

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={handleClick}
      aria-label={
        !linked
          ? `Enter ${titanBotName} and sign up for a free Pro trial`
          : active
            ? `Pro trial active, ${remainingLabel} remaining`
            : label
      }
    >
      {displayLabel}
    </button>
  );
}
