import "./globals.css";

import { ReactNode } from "react";

export const metadata = {
  title: "LifeOS MVP",
  description: "AI assistant dashboard scaffold"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
