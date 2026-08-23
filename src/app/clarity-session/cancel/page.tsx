import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ClaritySessionCancelPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Checkout cancelled</CardTitle>
          <CardDescription>No charge was made. You can pick up where you left off anytime.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg">
            <Link href="/clarity-session">Back to Business Clarity Session</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
