import { Link } from "react-router-dom";
import { COMMUNITY_ENTRY_LABEL, COMMUNITY_PATH } from "../config/community";
import "./enterSynexusButton.css";

/** Home-screen entry to the existing /community social network. */
export function EnterSynexusButton() {
  return (
    <Link
      className="enter-synexus enter-synexus--home"
      to={COMMUNITY_PATH}
      aria-label="Enter the SyNexus social network"
    >
      {COMMUNITY_ENTRY_LABEL}
    </Link>
  );
}
