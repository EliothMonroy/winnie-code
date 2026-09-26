import type { ReactNode } from "react";
import { Link } from "../router";
import { LogoMark } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ center, actions }: { center?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="header">
      <Link to="/" className="brand" aria-label="Winnie Code: all problems">
        <LogoMark />
        <span className="brand-text">
          Winnie <span className="brand-accent">Code</span>
        </span>
      </Link>
      <div className="header-center">{center}</div>
      <div className="header-actions">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
