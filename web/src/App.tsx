import { ProblemList } from "./pages/ProblemList";
import { ProblemPage } from "./pages/ProblemPage";
import { usePathname } from "./router";

export function App() {
  const pathname = usePathname();
  const match = /^\/p\/([a-z0-9-]+)\/?$/.exec(pathname);
  if (match) return <ProblemPage key={match[1]} slug={match[1]} />;
  return <ProblemList />;
}
