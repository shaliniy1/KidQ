import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KidQ — Screen time that ends well",
  description: "A calm, finite, parent-picked screen-time experience for children.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
