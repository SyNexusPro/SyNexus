type ScreenshotId = "scanner" | "whale" | "risk" | "alerts" | "oracle";

type FrameProps = {
  id: ScreenshotId;
  title: string;
  caption: string;
};

function ScreenshotFrame({ id, title, caption }: FrameProps) {
  return (
    <figure className="app-screenshot">
      <div className="app-screenshot__device" data-screenshot={id}>
        <div className="app-screenshot__statusbar">
          <span>Synexus</span>
          <span>9:41</span>
        </div>
        <div className="app-screenshot__screen">
          {id === "scanner" ? (
            <>
              <p className="app-screenshot__eyebrow">Live scanner</p>
              <p className="app-screenshot__headline">BONK · scanning</p>
              <ul className="app-screenshot__scan-list">
                <li>
                  <span>Liquidity drift</span>
                  <span className="is-ok">Stable</span>
                </li>
                <li>
                  <span>Volume spike</span>
                  <span className="is-warn">+142%</span>
                </li>
                <li>
                  <span>Holder concentration</span>
                  <span className="is-ok">Moderate</span>
                </li>
              </ul>
            </>
          ) : null}
          {id === "whale" ? (
            <>
              <p className="app-screenshot__eyebrow">Whale tracker</p>
              <p className="app-screenshot__headline">Titan lane</p>
              <div className="app-screenshot__whale-row">
                <span>Top wallet</span>
                <strong>18.4%</strong>
              </div>
              <div className="app-screenshot__whale-row">
                <span>Top 5 wallets</span>
                <strong>41.2%</strong>
              </div>
              <p className="app-screenshot__hint">Large exit detected · 12m ago</p>
            </>
          ) : null}
          {id === "risk" ? (
            <>
              <p className="app-screenshot__eyebrow">Risk score</p>
              <p className="app-screenshot__score">72</p>
              <p className="app-screenshot__band is-warn">Warning</p>
              <ul className="app-screenshot__reasons">
                <li>Thin liquidity vs volume</li>
                <li>Sharp pump in last hour</li>
              </ul>
            </>
          ) : null}
          {id === "alerts" ? (
            <>
              <p className="app-screenshot__eyebrow">Pulse alerts</p>
              <ul className="app-screenshot__alerts">
                <li>
                  <strong>PEPE</strong>
                  <span>Danger · liquidity drop</span>
                </li>
                <li>
                  <strong>WIF</strong>
                  <span>Warning · whale accumulation</span>
                </li>
                <li>
                  <strong>SOL</strong>
                  <span>Safe · Sentinel clear</span>
                </li>
              </ul>
            </>
          ) : null}
          {id === "oracle" ? (
            <>
              <p className="app-screenshot__eyebrow">Titan</p>
              <div className="app-screenshot__chat app-screenshot__chat--bot">
                Welcome to the SyNexus, the future of trading.
              </div>
              <div className="app-screenshot__chat app-screenshot__chat--user">
                Brief me on BONK risk.
              </div>
              <div className="app-screenshot__chat app-screenshot__chat--bot">
                Sentinel read: Warning band. Volume elevated; verify mint before size.
              </div>
            </>
          ) : null}
        </div>
      </div>
      <figcaption className="app-screenshot__caption">
        <strong>{title}</strong>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}

const FRAMES: FrameProps[] = [
  {
    id: "scanner",
    title: "Token scanner",
    caption: "Live Sentinel scans on liquidity, volume, and holder patterns.",
  },
  {
    id: "whale",
    title: "Whale tracker",
    caption: "Titan lane surfaces concentration and large-wallet moves.",
  },
  {
    id: "risk",
    title: "Risk score",
    caption: "0–100 score with Safe, Warning, or Danger bands and reasons.",
  },
  {
    id: "alerts",
    title: "Alerts",
    caption: "Pulse pushes Sentinel hits to your watchlist and feed.",
  },
  {
    id: "oracle",
    title: "AI assistant",
    caption: "Titan explains tokens and Sentinel context on demand.",
  },
];

type Props = {
  className?: string;
  showPlayHint?: boolean;
};

export function AppScreenshotGallery({ className = "", showPlayHint = false }: Props) {
  return (
    <section className={`app-screenshot-gallery ${className}`.trim()} aria-label="App screenshots">
      {showPlayHint ? (
        <p className="app-screenshot-gallery__play-hint">
          Preview frames below mirror in-app surfaces — capture from a device or use these for store listing
          drafts until production screenshots are exported.
        </p>
      ) : null}
      <div className="app-screenshot-gallery__track">
        {FRAMES.map((frame) => (
          <ScreenshotFrame key={frame.id} {...frame} />
        ))}
      </div>
    </section>
  );
}
