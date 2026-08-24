"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatCurrency";
import { ADMIN_SECRET_STORAGE_KEY } from "@/lib/clarityAdminStorage";

interface FulfillmentRow {
  id: string;
  customerEmail: string | null;
  status: string;
  intakeStatus: string;
  schedulingStatus: string;
  amountMinorUnits: number;
  currency: string;
  founderPricingApplied: boolean;
  scheduledAt: string | null;
  createdAt: string;
}

/**
 * Internal fulfillment queue. Not linked from anywhere customer-facing
 * — reached only by URL. Gated by a shared secret entered here and
 * kept in sessionStorage (cleared when the tab closes), sent as the
 * `x-admin-secret` header on every API call. See adminAuth.ts for why
 * this is a stopgap, not a real auth system.
 */
export default function ClarityFulfillmentListPage() {
  const [secret, setSecret] = useState<string | null>(null);
  const [secretInput, setSecretInput] = useState("");
  const [rows, setRows] = useState<FulfillmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(ADMIN_SECRET_STORAGE_KEY);
    if (stored) setSecret(stored);
  }, []);

  useEffect(() => {
    if (!secret) return;
    fetch("/api/internal/clarity-fulfillment", { headers: { "x-admin-secret": secret } })
      .then((res) => {
        if (res.status === 401) throw new Error("unauthorized");
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data: FulfillmentRow[]) => setRows(data))
      .catch((err) => {
        if (err instanceof Error && err.message === "unauthorized") {
          window.sessionStorage.removeItem(ADMIN_SECRET_STORAGE_KEY);
          setSecret(null);
          setError("Incorrect secret.");
        } else {
          setError("Unable to load the fulfillment queue.");
        }
      });
  }, [secret]);

  function handleUnlock(event: FormEvent) {
    event.preventDefault();
    window.sessionStorage.setItem(ADMIN_SECRET_STORAGE_KEY, secretInput);
    setSecret(secretInput);
    setError(null);
  }

  if (!secret) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Internal access</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3" onSubmit={handleUnlock}>
              <Label htmlFor="secret">Admin secret</Label>
              <Input
                id="secret"
                type="password"
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                autoComplete="off"
              />
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button type="submit">Unlock</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Business Clarity Session — Fulfillment Queue</h1>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!rows ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No purchases yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <Link key={row.id} href={`/internal/clarity-fulfillment/${row.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-6">
                  <div>
                    <p className="font-medium">{row.customerEmail ?? "(no email on file)"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(row.amountMinorUnits, row.currency)}
                      {row.founderPricingApplied ? " · founding rate" : ""} ·{" "}
                      {new Date(row.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 text-xs">
                    <span className="font-medium">{row.status}</span>
                    <span className="text-muted-foreground">
                      intake: {row.intakeStatus} · scheduling: {row.schedulingStatus}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
