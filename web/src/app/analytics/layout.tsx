import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your child's viewing — KidQ",
  description: "A gentle look at what your child watched and did on KidQ.",
};

export default function AnalyticsLayout({ children }: LayoutProps<"/analytics">) {
  return children;
}
