import { useEffect, useRef } from "react";

type Props = {
  className?: string;
  alive?: boolean;
};

const GLYPHS =
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789<>*+|:.=ABCDEF";

/**
 * Matrix-style digital rain on deep black — falls around the brand and down the page.
 * Kept export name so existing home wiring stays intact.
 */
export function CircuitBoardBackdrop({ className, alive = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const parent = canvas.parentElement;
    let width = 0;
    let height = 0;
    let columns = 0;
    let drops: number[] = [];
    let speeds: number[] = [];
    let raf = 0;
    let last = 0;
    const fontSize = 14;
    let reduced = !alive;

    try {
      reduced = reduced || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* keep reduced from alive */
    }

    function resize() {
      if (!canvas || !parent || !ctx) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.ceil(width / fontSize);
      drops = Array.from({ length: columns }, () => Math.random() * -40);
      speeds = Array.from({ length: columns }, () => 0.55 + Math.random() * 0.9);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);
    }

    function draw(ts: number) {
      if (!ctx) return;
      const dt = last ? Math.min(48, ts - last) : 16;
      last = ts;

      // Trail fade — keeps the classic Matrix persistence look
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      ctx.textBaseline = "top";

      for (let i = 0; i < columns; i++) {
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];

        // Bright head
        ctx.fillStyle = "#d8ffe0";
        ctx.shadowColor = "rgba(0, 255, 70, 0.85)";
        ctx.shadowBlur = 8;
        ctx.fillText(ch, x, y);

        // Dimmer trail glyph just above
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(0, 255, 65, 0.55)";
        const trail = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        ctx.fillText(trail, x, y - fontSize);

        drops[i] += speeds[i] * (dt / 16);

        if (y > height && Math.random() > 0.975) {
          drops[i] = Math.random() * -24;
          speeds[i] = 0.55 + Math.random() * 0.9;
        }
      }

      raf = window.requestAnimationFrame(draw);
    }

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(parent ?? document.body);

    if (reduced) {
      // Static first frame only
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      for (let i = 0; i < columns; i++) {
        for (let row = 0; row < Math.ceil(height / fontSize); row++) {
          if (Math.random() > 0.82) continue;
          ctx.fillStyle = `rgba(0, 255, 65, ${0.08 + Math.random() * 0.35})`;
          ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * fontSize, row * fontSize);
        }
      }
    } else {
      raf = window.requestAnimationFrame(draw);
    }

    return () => {
      ro.disconnect();
      window.cancelAnimationFrame(raf);
    };
  }, [alive]);

  return (
    <div className={`circuit-board matrix-rain${className ? ` ${className}` : ""}`} aria-hidden>
      <canvas ref={canvasRef} className="matrix-rain__canvas" />
      <div className="matrix-rain__veil" />
    </div>
  );
}
