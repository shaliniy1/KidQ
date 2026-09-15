import type { Metadata } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import "../../../kidq-design-tokens.css";
import "./globals.css";

// kidq-design-tokens.css is the repo's single source of truth for KidQ's palette,
// type scale, and component primitives (see repo root README / the file's own header
// comment) — imported directly from its canonical location rather than duplicated
// into web/, so design changes never have to be kept in sync by hand.
const baloo2 = Baloo_2({
  variable: "--kq-font-display-family",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const nunito = Nunito({
  variable: "--kq-font-body-family",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "KidQ",
  description: "KidQ — a calm, curated screen-time companion for ages 0-6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${baloo2.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
