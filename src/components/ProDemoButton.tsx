import { useNavigate } from "react-router-dom";
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
  label = "Try 5-minute Pro demo",
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
      aria-label={active ? `Pro demo active, ${remainingLabel} remaining` : label}
    >
      {active ? `Pro demo · ${remainingLabel} left` : label}
    </button>
  );
}
