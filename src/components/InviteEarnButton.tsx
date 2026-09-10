import { Link } from "react-router-dom";

type Props = {
  className?: string;
  label?: string;
};

export function InviteEarnButton({ className = "invite-earn-btn", label = "Invite and Earn" }: Props) {
  return (
    <Link to="/invite" className={className}>
      {label}
    </Link>
  );
}
