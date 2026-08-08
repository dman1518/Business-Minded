import Link from "next/link";

/**
 * Shared footer: trust links (Methodology, Privacy, Contact) plus a
 * concise disclaimer that this is educational business guidance, not a
 * formal valuation, accounting opinion, or financial advice. Kept as a
 * small shared component so future pages can reuse it without
 * duplicating the disclaimer copy.
 */
export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 w-full max-w-2xl border-t border-border px-4 py-8 text-center sm:px-6">
      <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <Link href="/methodology" className="hover:text-foreground hover:underline underline-offset-2">
          Methodology
        </Link>
        <Link href="/privacy" className="hover:text-foreground hover:underline underline-offset-2">
          Privacy
        </Link>
        <Link href="/contact" className="hover:text-foreground hover:underline underline-offset-2">
          Contact
        </Link>
      </nav>
      <p className="mx-auto mt-4 max-w-lg text-xs leading-relaxed text-muted-foreground">
        Business Minded provides educational business guidance based on your self-reported
        answers. It is not a formal business valuation, an accounting opinion, or financial or
        investment advice — for decisions with real financial or legal consequences, consult a
        qualified professional.
      </p>
    </footer>
  );
}
