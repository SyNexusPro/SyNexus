import { Link } from "react-router-dom";
import { LEGAL_EFFECTIVE_DATE, OPERATOR_LABEL, SUPPORT_EMAIL } from "../config/site";

const EFFECTIVE_LABEL = `Effective date: ${LEGAL_EFFECTIVE_DATE}`;

export function Terms() {
  return (
    <div className="page legal-page">
      <p className="legal-page__eyebrow">{EFFECTIVE_LABEL}</p>
      <h1 className="legal-page__title">Terms of Service</h1>
      <p className="legal-page__summary">
        These Terms of Service (&quot;Terms&quot;) are a binding agreement between you and {OPERATOR_LABEL}{" "}
        (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) governing access to the Synexus mobile and web
        application, dashboards, AI features, subscriptions, and related services (collectively, the
        &quot;Service&quot;). By accessing or using the Service, creating an account, or
        completing a purchase, you agree to these Terms and our{" "}
        <Link to="/privacy">Privacy Policy</Link>. If you do not agree, do not use the Service.
      </p>

      <p className="legal-page__summary legal-page__summary--compact">
        See also: <Link to="/disclaimer">Disclaimer</Link>
        {" · "}
        <Link to="/faq">FAQ</Link>
        {" · "}
        <Link to="/contact">Contact</Link>
      </p>

      <section className="legal-section marketing-panel">
        <h2>1 · Who we are</h2>
        <p>
          Synexus is an informational technology platform. We are not a broker-dealer, exchange, custodian,
          wallet provider, investment adviser, commodity trading adviser, money transmitter, or bank. We do not
          execute trades, hold customer funds or digital assets, or provide personalized investment
          recommendations. The Service aggregates, organizes, and presents data and software features for your
          own independent review.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>2 · Eligibility</h2>
        <p>
          You must be at least eighteen (18) years old—or the age of majority where you live, if higher—and
          have legal capacity to enter this agreement. You may not use the Service if you are barred under
          applicable law, subject to sanctions, or located in a jurisdiction where use of the Service or
          related digital-asset tools would be illegal. You represent that information you provide is accurate
          and that you will comply with all laws that apply to you, including tax and securities laws in your
          jurisdiction.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Not financial, legal, or tax advice</h2>
        <p>
          Synexus provides informational tooling, dashboards, summaries, alerts, rankings, scores, synthetic
          agent outputs, voice briefings, AI-generated text, and links to third-party sites.{" "}
          <strong>Nothing on the Service is investment, trading, legal, tax, accounting, or other professional
          advice.</strong> We do not recommend, endorse, or solicit buying, selling, holding, staking,
          bridging, or otherwise transacting in any asset. Labels such as &quot;safe,&quot; &quot;warning,&quot;
          &quot;danger,&quot; grades, confidence percentages, momentum reads, or Sentinel / Titan
          commentary are automated or heuristic summaries—not guarantees. Always do your own research and consult
          qualified professionals before making decisions.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>AI, automation, and simulated features</h2>
        <p>
          Parts of the Service use automated systems, including features branded as Sentinels and Titan,
          scanners, and similar tools. These systems may use third-party data, heuristics, machine learning, or
          synthetic presentation (including levels, XP, or demo-style metrics).{" "}
          <strong>Outputs may be incomplete, delayed, inaccurate, or misleading.</strong> AI and automated
          systems can hallucinate, misclassify assets, miss scams or rugs, or produce false positives. Voice
          and conversational features are for convenience only. You must independently verify any information
          before acting on it. We do not warrant that any feature will detect fraud, prevent loss, or improve
          trading results.
        </p>
      </section>

      <section className="legal-section marketing-panel legal-section--risk">
        <h2>Risk · assumption of risk</h2>
        <p>
          Digital assets and trading involve substantial risk of total loss. Prices are volatile; projects may
          fail, liquidity may disappear, and smart-contract, bridge, oracle, or chain-level failures may occur.
          You use Synexus <strong>entirely at your own risk</strong>. You assume all risks associated with
          digital assets and any decision you make before, during, or after using the Service. Past or simulated
          patterns do not predict future results. To the fullest extent permitted by law, you release us from
          claims arising from trading losses or reliance on Service content, except where such release is
          prohibited.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Accounts and operator links</h2>
        <p>
          Where we offer registration or sign-in (for example via Supabase or similar identity providers), you
          must provide accurate information and safeguard your credentials. You are responsible for all activity
          under your account. Notify us promptly of unauthorized access. We may suspend or terminate access,
          remove content, or refuse service if we reasonably believe these Terms are violated, the Service is
          misused, fraud or abuse is suspected, or we must do so for legal, security, or operational reasons.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Subscriptions and billing</h2>
        <p>
          Paid plans (including Synexus Pro at the price shown at checkout, currently $9.99/month where
          applicable) include a <strong>7-day free trial</strong> of full Pro access after you create and
          verify your account and add a payment method to start your free trial. After the trial, billing on a recurring
          basis begins only when you subscribe through checkout. Payment is processed by third-party payment
          processors (such as Stripe). By subscribing, you authorize us and our processors to charge your
          payment method on a recurring basis until you cancel according to checkout and processor flows. Prices, taxes, and
          features may change with notice where required by law. Unless mandatory law provides otherwise,{" "}
          <strong>fees are non-refundable</strong> once a billing period begins, including partial periods.
          Failed payments, disputed charges, or chargebacks may suspend paid features. Cancel before renewal to
          avoid future charges.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>User content and reports</h2>
        <p>
          If you submit token reports, feedback, messages, or other content (&quot;User Content&quot;), you
          represent that you have the right to submit it and that it is not unlawful, defamatory, or
          infringing. You grant us a worldwide, non-exclusive, royalty-free license to use, store, reproduce,
          modify, and display User Content to operate, improve, and secure the Service. We may remove or ignore
          User Content at our discretion. You remain solely responsible for User Content and for any trades or
          actions you take based on your submissions or on others&apos; submissions.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Acceptable use</h2>
        <p>
          You agree not to: (a) break the law or others&apos; rights; (b) scrape, crawl, or harvest the Service
          except as allowed by robots.txt or written permission; (c) reverse engineer, decompile, or attempt to
          extract source code except where prohibited by law; (d) interfere with security or availability; (e)
          misrepresent affiliation with us; (f) use the Service to spam, manipulate markets, or coordinate
          harmful activity; (g) circumvent paywalls or access controls; or (h) use the Service in a manner that
          could harm us, other users, or third parties.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Intellectual property</h2>
        <p>
          The Service, including software, design, logos, Synexus and Sentinel branding, and our content, is
          owned by us or our licensors and protected by intellectual-property laws. We grant you a limited,
          revocable, non-exclusive, non-transferable license to use the Service for personal, non-commercial
          purposes in accordance with these Terms. You may not copy, resell, sublicense, or create derivative
          works from the Service except as permitted by law.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Trading fees</h2>
        <p>
          When you initiate a swap through Synexus shortcuts (for example, links to Jupiter with Synexus platform
          fees enabled), a <strong>platform trading fee</strong> may apply based on your plan:{" "}
          <strong>0.10%</strong> for free accounts and <strong>0.05%</strong> for Synexus Pro subscribers, calculated
          on the notional value of the swap. This fee is in addition to third-party costs such as blockchain network
          fees, DEX spreads, slippage, and any fees charged by Jupiter or other aggregators. Fee rates, eligibility
          for discounts, and revenue allocation policies are described in the{" "}
          <Link to="/liquidity-treasury">Synexus Coin Liquidity Treasury</Link> and may change with notice where
          required. You authorize applicable platform fees when you confirm a qualifying swap in your connected
          wallet. We do not guarantee that every trade path will collect fees until on-chain integration is fully
          live.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Third parties</h2>
        <p>
          The Service may link to or rely on wallets, explorers, charts, DEX aggregators, RPC providers,
          analytics APIs, social platforms, payment processors, hosting providers, and other third parties we
          do not control. Their terms, privacy policies, fees, outages, bugs, hacks, scams, misleading data,
          downtime, geographic blocks, regulatory actions, and behavior are their responsibility—not ours—even
          when we provide in-app shortcuts (for example, opens in a new tab). Your use of third-party services
          is at your own risk.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>App stores</h2>
        <p>
          If you obtain the Service through Apple App Store, Google Play, or another marketplace, that store&apos;s
          terms may also apply. To the extent of any conflict with store-required terms, the store terms may
          govern solely with respect to your use of the app obtained through that store. Stores are not parties
          to these Terms and have no obligation to provide maintenance or support for the Service.
        </p>
      </section>

      <section className="legal-section marketing-panel legal-section--risk">
        <h2>Disclaimer of warranties</h2>
        <p>
          THE SERVICE IS PROVIDED <strong>&quot;AS IS&quot;</strong> AND <strong>&quot;AS AVAILABLE.&quot;</strong> TO THE FULLEST
          EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY,
          FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT UNINTERRUPTED,
          ERROR-FREE, SECURE, OR VIRUS-FREE OPERATION, OR THAT DATA WILL BE ACCURATE OR TIMELY.
        </p>
      </section>

      <section className="legal-section marketing-panel legal-section--risk">
        <h2>Limitation of liability</h2>
        <p>
          TO THE FULLEST EXTENT PERMITTED BY LAW, {OPERATOR_LABEL.toUpperCase()} AND ITS OWNERS, AFFILIATES,
          OFFICERS, DIRECTORS, EMPLOYEES, CONTRACTORS, AND CONTRIBUTORS WILL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA,
          GOODWILL, OR TRADING OR DIGITAL-ASSET LOSSES, ARISING FROM YOUR USE OF THE SERVICE OR RELIANCE ON
          ITS CONTENT, EVEN IF ADVISED OF THE POSSIBILITY. OUR AGGREGATE LIABILITY FOR ANY CLAIM ARISING FROM
          THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US FOR THE SERVICE IN THE TWELVE
          (12) MONTHS BEFORE THE CLAIM, OR (B) ONE HUNDRED US DOLLARS ($100), IF YOU HAVE NOT PAID US. SOME
          JURISDICTIONS DO NOT ALLOW CERTAIN LIMITS; IN THOSE JURISDICTIONS, LIABILITY IS LIMITED TO THE
          MAXIMUM PERMITTED BY LAW. NOTHING HERE LIMITS LIABILITY THAT CANNOT BE LIMITED BY LAW (INCLUDING
          FRAUD OR WILLFUL MISCONDUCT WHERE APPLICABLE).
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Indemnification</h2>
        <p>
          You agree to defend, indemnify, and hold harmless {OPERATOR_LABEL} and those acting on its behalf from
          any claims, damages, losses, liabilities, and expenses (including reasonable attorneys&apos; fees)
          arising from: your use of the Service; your User Content; your violation of these Terms or applicable
          law; your violation of third-party rights; or trades, wallet activity, or other actions you initiate
          after using informational features of the Service.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Termination</h2>
        <p>
          You may stop using the Service at any time. We may suspend or terminate access with or without notice
          if we believe it necessary. Upon termination, your right to use the Service ends. Sections that by
          nature should survive (including disclaimers, limitations of liability, indemnity, and dispute
          provisions) will survive.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Changes</h2>
        <p>
          We may update these Terms from time to time. We will post the revised Terms with an updated effective
          date. Where required by law, we will provide additional notice. Continued use after the effective date
          of changes constitutes acceptance, except where prohibited. If you do not agree, you must stop using
          the Service and cancel any paid plan.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Disputes · governing law</h2>
        <p>
          Before filing a claim, you agree to contact us and attempt to resolve the dispute informally. These
          Terms are governed by the laws of the United States and the State of Delaware, excluding conflict-of-law
          rules, except where mandatory consumer protection laws in your country of residence require otherwise.
          Except for small-claims matters and requests for injunctive relief, any dispute arising from these
          Terms or the Service shall be resolved by binding individual arbitration under the rules of the
          American Arbitration Association, unless you opt out within thirty (30) days of first accepting these
          Terms by written notice to us.{" "}
          <strong>You and we waive any right to participate in a class, collective, or representative
          action</strong> to the extent permitted by law. If arbitration is unenforceable, exclusive jurisdiction
          lies in the state or federal courts located in Delaware, and you consent to personal jurisdiction there.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>General</h2>
        <p>
          These Terms, together with the Privacy Policy and checkout disclosures, are the entire agreement
          regarding the Service. If any provision is unenforceable, the remainder stays in effect. Our failure
          to enforce a provision is not a waiver. You may not assign these Terms without our consent; we may
          assign them in connection with a merger, acquisition, or sale of assets. No third party is a
          beneficiary of these Terms except as expressly stated.
        </p>
      </section>

      <p className="legal-page__note">
        This document summarizes key legal terms for users of Synexus. It is not legal advice. Have qualified
        counsel review these Terms for your entity, jurisdiction, and product before relying on them for
        compliance. Questions:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        {" · "}
        <Link to="/contact">Contact</Link>
      </p>

      <p className="legal-page__back">
        <Link to="/">← Back to feed</Link>
        {" · "}
        <Link to="/privacy">Privacy Policy</Link>
        {" · "}
        <Link to="/liquidity-treasury">Liquidity Treasury</Link>
        {" · "}
        <Link to="/disclaimer">Disclaimer</Link>
        {" · "}
        <Link to="/faq">FAQ</Link>
      </p>
    </div>
  );
}
