import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  normalizeAffiliateHandle,
  saveAffiliateHandle,
} from "../config/ecosystem";

/** /ref/:handle → save handle and land on home (SyNexus affiliate preview links). */
export function AffiliateReferralRedirect() {
  const { handle = "" } = useParams<{ handle: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const normalized = normalizeAffiliateHandle(handle);
    if (normalized && normalized !== "your-handle") {
      saveAffiliateHandle(normalized);
    }
    navigate("/", { replace: true });
  }, [handle, navigate]);

  return null;
}
