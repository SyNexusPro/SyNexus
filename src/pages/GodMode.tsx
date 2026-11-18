import { Navigate } from "react-router-dom";
import { GodModeLogin } from "../components/GodModeLogin";
import { isOwnerScreen } from "../lib/ownerScreen";

export function GodMode() {
  if (!isOwnerScreen()) return <Navigate to="/" replace />;
  return (
    <div className="page page--god-mode">
      <GodModeLogin redirectTo="/owner/hera" />
    </div>
  );
}
