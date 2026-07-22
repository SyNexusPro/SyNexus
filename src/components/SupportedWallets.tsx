import { SUPPORTED_WALLETS } from "../config/site";

type Props = {
  className?: string;
};

export function SupportedWallets({ className = "" }: Props) {
  return (
    <div className={`supported-wallets ${className}`.trim()}>
      <ul className="supported-wallets__grid">
        {SUPPORTED_WALLETS.map((wallet) => (
          <li key={wallet.id}>
            <a
              className="supported-wallets__card"
              href={wallet.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {wallet.icon ? (
                <img className="supported-wallets__icon" src={wallet.icon} alt="" aria-hidden />
              ) : (
                <span className="supported-wallets__glyph" aria-hidden>
                  ◎
                </span>
              )}
              <span className="supported-wallets__name">{wallet.name}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="supported-wallets__note">
        Any Solana wallet compatible with Jupiter swap flows works with SyNexus trade shortcuts.
      </p>
    </div>
  );
}
