import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from "react";

export function navigate(to: string): void {
  if (to === window.location.pathname) return;
  window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

export function usePathname(): string {
  const [pathname, setPathname] = useState(window.location.pathname);
  useEffect(() => {
    const onChange = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);
  return pathname;
}

type LinkProps = { to: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

/** Client-side link; modified clicks (new tab etc.) fall through to the browser. */
export function Link({ to, onClick, ...rest }: LinkProps) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  }
  return <a href={to} onClick={handleClick} {...rest} />;
}
