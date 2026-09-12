import { Component, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { OracleConversationContext } from "../../lib/oracleSupremeConversation";
import { OracleSupremeChat } from "../OracleSupremeChat";

type Props = {
  context: OracleConversationContext;
  onClose: () => void;
  autoListen?: boolean;
  seedUtterance?: string | null;
  wakePulse?: boolean;
  guidedDemo?: boolean;
};

class HeraScreenBoundary extends Component<
  { onClose: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[HeraScreen]", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="hera-screen" role="dialog" aria-modal="true" aria-label="Hera">
          <button type="button" className="hera-screen__close" onClick={this.props.onClose} aria-label="Close Hera">
            ×
          </button>
          <div className="hera-screen__stage">
            <p className="hera-screen__caption">Hera is ready. Close and say her name again if the face didn’t load.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Dedicated full-screen Hera view — portaled to document.body so the
 * dashboard, logo, and bottom nav are not part of this tree.
 */
export function HeraScreen({
  context,
  onClose,
  autoListen = false,
  seedUtterance = null,
  wakePulse = false,
  guidedDemo = false,
}: Props) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("hera-mode");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      root.classList.remove("hera-mode");
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <HeraScreenBoundary onClose={onClose}>
      <OracleSupremeChat
        context={context}
        variant="hera-screen"
        onDismiss={onClose}
        autoListen={autoListen}
        seedUtterance={seedUtterance}
        wakePulse={wakePulse}
        guidedDemo={guidedDemo}
      />
    </HeraScreenBoundary>,
    document.body,
  );
}
