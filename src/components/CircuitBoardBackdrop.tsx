import { useEffect, useRef } from "react";
import { isNativeAndroid } from "../lib/bootExperience";
import { useAppIsActive } from "../hooks/useAppIsActive";

type Props = {
  className?: string;
  alive?: boolean;
};

const GLYPHS =
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789<>*+|";

/**
 * Matrix-style rain on deep black.
 * Android / reduced-motion: static CSS field only (no canvas rAF — prevents WebView freezes).
 *
 * Important: never write canvas.style width/height from a ResizeObserver on the parent —
 * that feedback loop throws RangeError: Maximum call stack size exceeded.
 */
export function CircuitBoardBackdrop({ className, alive = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appActive = useAppIsActive();
  const useCanvas = alive && !isNativeAndroid();

  useEffect(() => {
    if (!useCanvas) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    let width = 0;
    let height = 0;
    let columns = 0;
    let drops: number[] = [];
    let speeds: number[] = [];
    let drawRaf = 0;
    let resizeRaf = 0;
    let last = 0;
    let running = true;
    const fontSize = 16;
    let reduced = false;

    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduced = false;
    }

    function applySize(nextW: number, nextH: number) {
      if (!canvas || !ctx) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const w = Math.max(1, Math.floor(nextW));
      const h = Math.max(1, Math.floor(nextH));
      // Bail if unchanged — stops ResizeObserver feedback loops
      if (w === width && h === height) return false;

      width = w;
      height = h;
      // Bitmap size only. CSS keeps layout at width/height: 100% — do NOT set style sizes here.
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.max(8, Math.ceil(w / fontSize));
      drops = Array.from({ length: columns }, () => Math.random() * -30);
      speeds = Array.from({ length: columns }, () => 0.45 + Math.random() * 0.75);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, h);
      return true;
    }

    function resizeFromParent() {
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      applySize(rect.width, rect.height);
    }

    function draw(ts: number) {
      if (!ctx || !running) return;
      if (last && ts - last < 36) {
        drawRaf = window.requestAnimationFrame(draw);
        return;
      }
      const dt = last ? Math.min(50, ts - last) : 16;
      last = ts;

      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${fontSize}px ui-monospace, Menlo, Consolas, monospace`;
      ctx.textBaseline = "top";

      for (let i = 0; i < columns; i++) {
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        ctx.fillStyle = "#e8ffe8";
        ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], x, y);
        ctx.fillStyle = "rgba(0, 220, 70, 0.45)";
        ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], x, y - fontSize);
        drops[i] += speeds[i] * (dt / 16);
        if (y > height && Math.random() > 0.97) {
          drops[i] = Math.random() * -20;
          speeds[i] = 0.45 + Math.random() * 0.75;
        }
      }

      drawRaf = window.requestAnimationFrame(draw);
    }

    function startDraw() {
      if (reduced || !running || !appActive) return;
      window.cancelAnimationFrame(drawRaf);
      last = 0;
      drawRaf = window.requestAnimationFrame(draw);
    }

    resizeFromParent();

    const ro = new ResizeObserver((entries) => {
      // Schedule outside the RO callback to avoid sync re-entrancy / stack overflow
      window.cancelAnimationFrame(resizeRaf);
      resizeRaf = window.requestAnimationFrame(() => {
        const entry = entries[0];
        const box = entry?.contentRect;
        if (box) applySize(box.width, box.height);
        else resizeFromParent();
        startDraw();
      });
    });
    ro.observe(parent);

    if (reduced) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${fontSize}px ui-monospace, Menlo, Consolas, monospace`;
      for (let i = 0; i < columns; i += 2) {
        for (let row = 0; row < Math.ceil(height / fontSize); row += 2) {
          if (Math.random() > 0.7) continue;
          ctx.fillStyle = `rgba(0, 255, 65, ${0.1 + Math.random() * 0.28})`;
          ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * fontSize, row * fontSize);
        }
      }
    } else {
      startDraw();
    }

    return () => {
      running = false;
      ro.disconnect();
      window.cancelAnimationFrame(drawRaf);
      window.cancelAnimationFrame(resizeRaf);
    };
  }, [useCanvas, appActive]);

  if (!useCanvas) {
    return (
      <div
        className={`circuit-board matrix-rain matrix-rain--static${className ? ` ${className}` : ""}`}
        aria-hidden
      >
        <div className="matrix-rain__static" />
        <div className="matrix-rain__veil" />
      </div>
    );
  }

  return (
    <div className={`circuit-board matrix-rain${className ? ` ${className}` : ""}`} aria-hidden>
      <canvas ref={canvasRef} className="matrix-rain__canvas" />
      <div className="matrix-rain__veil" />
    </div>
  );
}
