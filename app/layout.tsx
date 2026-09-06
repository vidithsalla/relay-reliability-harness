import Link from "next/link";

import "./globals.css";

export const metadata = {
  title: "Relay",
  description: "Agent Deployment Reliability Harness"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link className="brand" href="/">
              Relay
            </Link>
            <nav className="nav" aria-label="Primary">
              <Link href="/scenarios">Scenarios</Link>
              <Link href="/runs">Traces</Link>
              <Link href="/review">Review Queue</Link>
              <Link href="/evals">Evals</Link>
              <Link href="/about">About</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
