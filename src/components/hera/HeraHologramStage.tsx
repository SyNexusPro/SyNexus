import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import type { HeraAvatarState, HeraEmotion, HeraViseme } from "../../lib/hera/types";
import { HeraExpressionStrip } from "./HeraExpressionStrip";

const HeraHologram = lazy(() =>
  import("./HeraHologram").then((m) => ({ default: m.HeraHologram })),
);

type Props = {
  state: HeraAvatarState;
  isActive?: boolean;
  audioLevel?: number;
  viseme?: HeraViseme | null;
  emotion?: HeraEmotion;
  statusLabel: string;
  expanded?: boolean;
  immersive?: boolean;
  onStageTap?: () => void;
  showStatePreview?: boolean;
  onPreviewState?: (state: HeraAvatarState | null) => void;
  previewState?: HeraAvatarState | null;
  forceEmotion?: HeraEmotion | null;
  onForceEmotion?: (emotion: HeraEmotion | null) => void;
};

const PREVIEW_STATES: HeraAvatarState[] = ["idle", "listening", "thinking", "speaking"];

/**
 * Lazy hologram stage — portrait face + optional expression strip.
 */
export function HeraHologramStage({
  state,
  isActive = true,
  audioLevel = 0,
  viseme = null,
  emotion = "neutral",
  statusLabel,
  expanded = false,
  immersive = false,
  onStageTap,
  showStatePreview = false,
  onPreviewState,
  previewState = null,
  forceEmotion = null,
  onForceEmotion,
}: Props) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`hera-hologram-stage${expanded ? " hera-hologram-stage--expanded" : ""}${immersive ? " hera-hologram-stage--immersive" : ""}`}
      onClick={onStageTap}
      role={onStageTap ? "button" : undefined}
      tabIndex={onStageTap ? 0 : undefined}
      onKeyDown={
        onStageTap
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onStageTap();
              }
            }
          : undefined
      }
      aria-label={onStageTap ? "Tap Hera to speak" : undefined}
    >
      {failed ? (
        <div className="hera-hologram-stage__fallback" role="img" aria-label="Hera hologram unavailable">
          <div className="hera-hologram-stage__fallback-ring" />
          <p>Hologram renderer unavailable — chat still works.</p>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="hera-hologram-stage__loading" aria-hidden>
              Projecting…
            </div>
          }
        >
          <HologramErrorBoundary onError={() => setFailed(true)}>
            <HeraHologram
              state={state}
              isActive={isActive}
              audioLevel={audioLevel}
              viseme={viseme}
              emotion={forceEmotion ?? emotion}
            />
          </HologramErrorBoundary>
        </Suspense>
      )}
      <p className="hera-hologram-stage__status" aria-live="polite">
        {statusLabel}
      </p>
      {immersive ? null : (
        <HeraExpressionStrip
          emotion={emotion}
          forceEmotion={forceEmotion}
          onChange={onForceEmotion}
        />
      )}
      {!immersive && showStatePreview && onPreviewState ? (
        <div
          className="hera-hologram-stage__preview"
          role="group"
          aria-label="Preview hologram states"
          onClick={(event) => event.stopPropagation()}
        >
          {PREVIEW_STATES.map((s) => (
            <button
              key={s}
              type="button"
              className={`hera-hologram-stage__preview-btn${previewState === s ? " is-active" : ""}`}
              onClick={() => onPreviewState(previewState === s ? null : s)}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

class HologramErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { err: boolean }
> {
  state = { err: false };

  static getDerivedStateFromError() {
    return { err: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.err) return null;
    return this.props.children;
  }
}
