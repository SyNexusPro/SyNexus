import { HomeEducationalHub } from "../components/HomeEducationalHub";
import { Link } from "react-router-dom";
import { useOpenTitanChat } from "../hooks/useOpenTitanChat";

export function LearningHub() {
  const openTitan = useOpenTitanChat();

  return (
    <div className="page tool-page">
      <section className="tool-page__hero marketing-panel">
        <p className="tool-page__eyebrow">Learning Hub</p>
        <h1 className="tool-page__title">Learn, upskill & grow with AI tutors</h1>
        <p className="tool-page__lede">
          Guides, FAQ, and Titan tutoring for Solana research, scam defense, and safer trading habits.
        </p>
        <div className="tool-page__actions">
          <Link className="tool-page__action" to="/faq">
            FAQ
          </Link>
          <Link className="tool-page__action" to="/blog">
            Journal
          </Link>
          <button type="button" className="tool-page__action" onClick={openTitan}>
            Ask Titan
          </button>
        </div>
      </section>

      <HomeEducationalHub />
    </div>
  );
}
