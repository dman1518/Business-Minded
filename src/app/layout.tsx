import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Business Minded — Business Health Check",
  description:
    "Answer a few questions and receive your Business Minded Score along with personalized recommendations to increase business value and reduce owner dependence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-white to-secondary/40">
        {children}
      </body>
    </html>
  );
}
