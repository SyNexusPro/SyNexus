import { useNavigate } from "react-router-dom";
import { SYNEXUS_PRO_TRIAL_LABEL } from "../config/proTrial";
import { useProDemo } from "../hooks/useProDemo";
import { useSynexusPlan } from "../hooks/useSynexusPlan";

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
  const { active, remainingLabel, beginDemo } = useProDemo();

  if (plan === "PRO" && !active) return null;

  function handleClick() {
    if (active) {
      if (goToPulse) navigate(`/pulse${pulseHash}`);
      return;
    }
    beginDemo();
    if (goToPulse) navigate(`/pulse${pulseHash}`);
  }

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={handleClick}
      aria-label={active ? `Pro trial active, ${remainingLabel} remaining` : label}
    >
      {active ? `Pro trial · ${remainingLabel}` : label}
    </button>
  );
}
