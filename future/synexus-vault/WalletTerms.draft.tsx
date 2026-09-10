import { Link } from "react-router-dom";
import { SYNEXUS_REFUND_POLICY_PATH } from "../../src/config/refundPolicy";
import { OPERATOR_LABEL, SUPPORT_EMAIL } from "../../src/config/site";
import {
  SYNEXUS_WALLET_PRODUCT_NAME,
  WALLET_TERMS_EFFECTIVE_DATE,
} from "./walletPolicy";

export function WalletTerms() {
  return (
    <div className="page legal-page">
      <p className="legal-page__eyebrow">Status: {WALLET_TERMS_EFFECTIVE_DATE}</p>
      <h1 className="legal-page__title">SyNexus Vault — Wallet Terms</h1>
      <p className="legal-page__summary legal-page__summary--compact">
        <strong>Draft outline for qualified counsel.</strong> Do not treat this as final compliance
        documentation until reviewed for your entity, jurisdictions, and product architecture.
      </p>
      <p className="legal-page__summary">
        These Wallet Terms (&quot;Wallet Terms&quot;) govern your use of {SYNEXUS_WALLET_PRODUCT_NAME} and
        related self-custodial wallet software features within the SyNexus mobile application (the
        &quot;Wallet&quot;), offered by {OPERATOR_LABEL} (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
        They supplement — and are incorporated into — our{" "}
        <Link to="/terms">Terms of Service</Link> and{" "}
        <Link to="/privacy">Privacy Policy</Link>. Capitalized terms not defined here have the meanings given
        in the Terms of Service. If there is a conflict between these Wallet Terms and the Terms of Service
        solely with respect to the Wallet, these Wallet Terms control for Wallet-specific matters.
      </p>

      <p className="legal-page__summary legal-page__summary--compact">
        See also: <Link to="/trust">Trust &amp; safety</Link>
        {" · "}
        <Link to="/disclaimer">Disclaimer</Link>
        {" · "}
        <Link to={SYNEXUS_REFUND_POLICY_PATH}>Refund Policy</Link>
        {" · "}
        <Link to="/faq">FAQ</Link>
      </p>

      <section className="legal-section marketing-panel">
        <h2>1 · What SyNexus Vault is</h2>
        <p>
          {SYNEXUS_WALLET_PRODUCT_NAME} is <strong>non-custodial wallet software</strong> that runs on your
          device. It helps you generate or import a Solana keypair, view balances, prepare transactions, and
          sign them locally before broadcast to the Solana blockchain. Sentinel risk reads and Titan summaries
          may appear before you sign; they are informational only.
        </p>
        <p>
          The Wallet is part of the broader SyNexus Service (research, alerts, subscriptions, and AI features).
          Creating a Wallet is <strong>separate</strong> from creating an Operator Link account for SyNexusPro
          or Pulse. Your email login does not give us access to your private keys, and your Wallet keys do not
          unlock our servers.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>2 · What we are not</h2>
        <p>
          We are <strong>not</strong> a bank, broker-dealer, exchange, custodian, trust company, investment
          adviser, commodity trading adviser, or money transmitter with respect to the Wallet. We do{" "}
          <strong>not</strong> take possession of, store, or control your digital assets or private keys on our
          servers. We cannot initiate transfers from your Wallet without your explicit authorization on your
          device. We do not guarantee execution, pricing, liquidity, or settlement of any on-chain transaction.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>3 · Eligibility</h2>
        <p>
          You must meet the eligibility requirements in the Terms of Service. You may not use the Wallet if
          doing so would violate applicable law, including sanctions administered by the U.S. Office of Foreign
          Assets Control (OFAC) or analogous authorities. You represent that you are not located in, ordinarily
          resident in, or acting on behalf of any sanctioned person or comprehensively sanctioned jurisdiction.
        </p>
      </section>

      <section className="legal-section marketing-panel legal-section--risk">
        <h2>4 · Self-custody · you own your keys</h2>
        <p>
          <strong>You alone control your Wallet.</strong> When you create a Wallet, the Wallet software generates
          a recovery phrase (seed phrase) and derived private keys that exist on your device.{" "}
          <strong>We never receive, transmit, or store your unencrypted seed phrase or private keys on our
          servers.</strong> On supported mobile builds, keys may be encrypted using your device&apos;s secure
          hardware (for example Keychain or Android Keystore) and unlocked with biometrics or device credentials
          you configure.
        </p>
        <p>
          Because we do not custody your keys, <strong>we cannot recover, reset, or restore your Wallet</strong>{" "}
          if you lose your seed phrase, lose your device, disable biometrics without backup, or delete the app
          without saving your recovery phrase. Loss of your seed phrase may result in permanent loss of access
          to associated digital assets.
        </p>
      </section>

      <section className="legal-section marketing-panel legal-section--risk">
        <h2>5 · Recovery phrase responsibilities</h2>
        <p>
          During Wallet setup you will be shown a recovery phrase. You must write it down offline and store it
          securely. Do not photograph it, email it, store it in cloud notes, or share it with anyone — including
          anyone claiming to be SyNexus support. We will never ask for your seed phrase, private key, or full
          recovery words.
        </p>
        <p>
          You are solely responsible for maintaining backups and for any person who obtains access to your
          recovery phrase or unlocked device. Anyone with your seed phrase can control your assets.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>6 · Creating, importing, and deleting a Wallet</h2>
        <p>
          You may create a new Wallet or import an existing Solana-compatible recovery phrase. Importing does
          not give us access to your keys — import occurs locally on your device. You may delete Wallet data
          from the app; deletion removes locally stored keys from the device subject to platform behavior.{" "}
          <strong>Deletion is irreversible</strong> unless you retained your recovery phrase and re-import it
          later.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>7 · Web vs mobile</h2>
        <p>
          {SYNEXUS_WALLET_PRODUCT_NAME} key creation and signing is intended for{" "}
          <strong>supported native mobile builds</strong> only. The SyNexus website may allow you to connect
          third-party wallets (for example Phantom or Solflare) or view public on-chain data, but the website
          will not persistently store your seed phrase or private keys in browser storage. Do not enter a seed
          phrase into any website unless you fully trust the origin and understand the risks.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>8 · Transaction signing and authorization</h2>
        <p>
          Each transfer, swap, approval, or program interaction requires your review and explicit confirmation
          on your device. You are responsible for verifying recipient addresses, token mints, amounts, network
          fees, and program permissions before you sign. Blockchain transactions are generally{" "}
          <strong>irreversible</strong> once confirmed.
        </p>
        <p>
          Sentinel Avoid, Watch, or OK verdicts, risk scores, and Titan explanations are automated summaries.
          They may block signing by default for certain reads, but you may override warnings where the app
          allows. Overriding a warning does not shift responsibility to us — you remain solely responsible for
          the transaction.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>9 · Swaps and third-party protocols</h2>
        <p>
          Swaps initiated through the Wallet may route through third-party aggregators and decentralized
          protocols (for example Jupiter). Those protocols are not operated by us. Slippage, failed routes,
          smart-contract bugs, MEV, and liquidity events can cause partial fills, reverts, or loss. Your use
          of third-party protocols is at your own risk and subject to their terms.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>10 · Platform trading fees</h2>
        <p>
          When enabled, qualifying swaps may include a SyNexus platform fee as described in the Terms of Service
          and <Link to="/liquidity-treasury">Liquidity Treasury</Link> documentation (for example 0.10% on free
          accounts and 0.05% on SyNexusPro, subject to change with notice where required). Fees are disclosed
          in the transaction preview before you sign. Network fees and third-party costs are additional.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>11 · Connected external wallets</h2>
        <p>
          If you choose to connect a third-party wallet instead of {SYNEXUS_WALLET_PRODUCT_NAME}, that wallet
          provider&apos;s terms and privacy policies apply to key management and signing. We receive limited
          information needed to display your public address and request signatures (for example via Wallet
          Standard or mobile wallet adapter flows). We do not control third-party wallet software.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>12 · Sanctions and prohibited use</h2>
        <p>
          You may not use the Wallet to evade sanctions, launder proceeds of crime, interact with prohibited
          addresses where we implement blocks, or violate the acceptable-use rules in the Terms of Service. We
          may restrict access to Wallet features, block certain addresses or regions, or terminate the Service if
          we reasonably believe you have violated law or these Wallet Terms.
        </p>
      </section>

      <section className="legal-section marketing-panel legal-section--risk">
        <h2>13 · No deposit insurance · no asset protection</h2>
        <p>
          Digital assets held in self-custodial wallets are <strong>not</strong> insured by the FDIC, SIPC, or
          any government deposit insurance scheme. We do not guarantee the value of any token. Smart-contract
          failures, exploits, bridge hacks, and market volatility can result in total loss.
        </p>
      </section>

      <section className="legal-section marketing-panel legal-section--risk">
        <h2>14 · Assumption of risk</h2>
        <p>
          You use the Wallet entirely at your own risk. You assume all risks associated with private-key
          management, device compromise, phishing, malware, user error, and on-chain activity. To the fullest
          extent permitted by law, you release us from claims arising from Wallet use or digital-asset losses
          except where such release is prohibited.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>15 · Updates to wallet software</h2>
        <p>
          We may update the Wallet to add features, fix bugs, or address security issues. You are responsible
          for installing updates from official app stores or authorized distribution channels. We are not liable
          for losses arising from outdated software, sideloaded builds, or modified clients not distributed by
          us.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>16 · Privacy</h2>
        <p>
          When you use the Wallet, we may process your public wallet address, transaction signatures you
          broadcast, device identifiers, crash logs, and feature usage as described in our Privacy Policy. We
          use RPC providers and indexers to display balances and history; those providers may log requests
          including your IP address and public address. We do not sell your seed phrase — we never possess it.
        </p>
      </section>

      <section className="legal-section marketing-panel legal-section--risk">
        <h2>17 · Disclaimer of warranties</h2>
        <p>
          THE WALLET IS PROVIDED <strong>&quot;AS IS&quot;</strong> AND{" "}
          <strong>&quot;AS AVAILABLE.&quot;</strong> TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL
          WARRANTIES REGARDING THE WALLET, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE WALLET WILL BE ERROR-FREE, UNINTERRUPTED, OR FREE OF
          VULNERABILITIES, OR THAT SENTINEL OR TITAN OUTPUTS WILL DETECT ALL SCAMS OR PREVENT LOSS.
        </p>
      </section>

      <section className="legal-section marketing-panel legal-section--risk">
        <h2>18 · Limitation of liability</h2>
        <p>
          TO THE FULLEST EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST DIGITAL ASSETS, LOST SEED PHRASES, UNAUTHORIZED
          TRANSACTIONS, OR TRADING LOSSES ARISING FROM WALLET USE, EVEN IF ADVISED OF THE POSSIBILITY. OUR
          AGGREGATE LIABILITY FOR WALLET-RELATED CLAIMS IS SUBJECT TO THE CAP IN THE TERMS OF SERVICE. SOME
          JURISDICTIONS DO NOT ALLOW CERTAIN LIMITS; IN THOSE JURISDICTIONS, LIABILITY IS LIMITED TO THE MAXIMUM
          PERMITTED BY LAW.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>19 · Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless {OPERATOR_LABEL} from claims arising from your Wallet use,
          your on-chain activity, your violation of these Wallet Terms or applicable law, or disputes with third
          parties related to transactions you signed, to the same extent as provided in the Terms of Service.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>20 · Regulatory notice (non-custodial software)</h2>
        <p>
          {SYNEXUS_WALLET_PRODUCT_NAME} is designed as <strong>self-custodial software</strong>: you hold your
          keys and interact directly with public blockchains. This model is intended to differ from custodial
          exchanges or hosted wallets where a provider controls customer funds. Regulatory treatment varies by
          jurisdiction and product features; nothing in these Wallet Terms constitutes legal or regulatory advice.
          We may modify or discontinue Wallet features where required by law or app-store policy.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>21 · Changes to these Wallet Terms</h2>
        <p>
          We may update these Wallet Terms before or after Vault launch. We will post the revised terms with an
          updated effective date and provide additional notice where required. Continued use of the Wallet after
          changes constitutes acceptance, except where prohibited. If you do not agree, stop using the Wallet and
          export your recovery phrase before deleting the app.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>22 · Disputes</h2>
        <p>
          Dispute resolution, governing law, and arbitration provisions in the Terms of Service apply to
          Wallet-related disputes, except where mandatory consumer law requires otherwise.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Counsel checklist (internal — remove or relocate before launch)</h2>
        <p>Before publishing as final, confirm with qualified U.S. crypto/fintech counsel:</p>
        <ul className="trust-page__bullets">
          <li>Architecture memo: keys never touch SyNexus servers; no recovery custody</li>
          <li>FinCEN / state MTL analysis for self-custodial software + Jupiter fee routing</li>
          <li>OFAC screening scope for RPC, address blocklists, and geographic restrictions</li>
          <li>Google Play Financial features declaration (non-custodial wallet category)</li>
          <li>Apple App Store crypto wallet review materials and export compliance if applicable</li>
          <li>Update Terms §1 (&quot;not a wallet provider&quot;) and Trust page wallet copy on launch</li>
          <li>Privacy Policy addendum: pubkey, tx history, secure enclave, RPC vendors</li>
          <li>New York BitLicense / EU MiCA triggers if product scope expands to custody or fiat</li>
        </ul>
      </section>

      <p className="legal-page__note">
        Draft Wallet Terms outline for {SYNEXUS_WALLET_PRODUCT_NAME}. Not legal advice. Questions:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        {" · "}
        <Link to="/contact">Contact</Link>
      </p>

      <p className="legal-page__back">
        <Link to="/">← Back to feed</Link>
        {" · "}
        <Link to="/terms">Terms of Service</Link>
        {" · "}
        <Link to="/privacy">Privacy Policy</Link>
        {" · "}
        <Link to="/trust">Trust</Link>
      </p>
    </div>
  );
}
