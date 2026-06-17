const STEPS = [
  {
    num: "01",
    title: "Paste any coin",
    detail: "Drop a token name or mint address into the scanner.",
  },
  {
    num: "02",
    title: "Read your answer",
    detail: "Synexus gives a simple verdict — don't buy, wait, or looks okay.",
  },
  {
    num: "03",
    title: "Trade in your wallet",
    detail: "You always sign in Phantom or your wallet. Synexus never holds funds.",
  },
] as const;

export function BeginnerQuickStart() {
  return (
    <section className="beginner-quickstart" aria-label="How Synexus works in 3 steps">
      <div className="beginner-quickstart__head">
        <p className="beginner-quickstart__eyebrow">Easy mode</p>
        <h2 className="beginner-quickstart__title">Three steps. That&apos;s it.</h2>
      </div>
      <ol className="beginner-quickstart__steps">
        {STEPS.map((step) => (
          <li key={step.num} className="beginner-quickstart__step">
            <span className="beginner-quickstart__num" aria-hidden>
              {step.num}
            </span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
