import type { ReactNode } from "react";

// The real <html> wrapper lives in [locale]/layout.tsx so we can set lang/dir
// per locale. This root layout only forwards children.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
