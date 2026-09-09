import type { HeraEmotion } from "../../lib/hera/types";
import { emotionLabel } from "../../lib/hera/types";

type Props = {
  emotion: HeraEmotion;
  onChange?: (emotion: HeraEmotion | null) => void;
  forceEmotion?: HeraEmotion | null;
};

const EXPRESSIONS: HeraEmotion[] = ["neutral", "thinking", "analyzing", "warning"];

export function HeraExpressionStrip({ emotion, onChange, forceEmotion = null }: Props) {
  return (
    <div className="hera-expressions" role="group" aria-label="Hera expressions">
      <p className="hera-expressions__label">Expressions</p>
      <div className="hera-expressions__row">
        {EXPRESSIONS.map((item) => {
          const active = (forceEmotion ?? emotion) === item;
          return (
            <button
              key={item}
              type="button"
              className={`hera-expressions__btn hera-expressions__btn--${item}${active ? " is-active" : ""}`}
              aria-pressed={active}
              onClick={() => onChange?.(forceEmotion === item ? null : item)}
            >
              <span className="hera-expressions__face" aria-hidden />
              <span className="hera-expressions__name">{emotionLabel(item)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
