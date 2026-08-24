/**
 * Shared client-side storage key for the internal Clarity Session
 * fulfillment UI's admin secret. Lives outside any page.tsx file
 * because Next.js App Router only allows a fixed set of named
 * exports from a page module (metadata, generateStaticParams, etc.)
 * — an arbitrary named export like this one fails `next build` type
 * checking ("... is not a valid Page export field").
 */
export const ADMIN_SECRET_STORAGE_KEY = "clarity_admin_secret";
