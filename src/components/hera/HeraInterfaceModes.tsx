import type { HeraInterfaceMode } from "../../lib/hera/types";
import { normalizeHeraMode } from "../../lib/hera/types";

type Props = {
  mode: HeraInterfaceMode;
  onChange: (mode: HeraInterfaceMode) => void;
  botName?: string;
};

const MODES: { id: Exclude<HeraInterfaceMode, "hologram">; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "voice", label: "Voice" },
  { id: "vision", label: "Vision" },
  { id: "analysis", label: "Analysis" },
];

export function HeraInterfaceModes({ mode, onChange, botName = "Hera" }: Props) {
  const active = normalizeHeraMode(mode);

  return (
    <div className="hera-interface-modes" role="tablist" aria-label={`${botName} interface mode`}>
      {MODES.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          className={`hera-interface-modes__btn${active === item.id ? " hera-interface-modes__btn--active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
