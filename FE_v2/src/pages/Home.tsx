import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAtomValue } from "jotai";
import { isAuthenticatedAtom } from "@/atoms/authAtoms";

export function Home() {
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">WisdomLinked</h1>
          <p className="text-xl text-muted-foreground">
            A modern consultation marketplace connecting customers with experts
          </p>
        </div>

        {!isAuthenticated && (
          <div className="flex gap-4 justify-center">
            <Link to="/register/customer">
              <Button size="lg">Get Started</Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline">
                Login
              </Button>
            </Link>
          </div>
        )}

        {isAuthenticated && (
          <div className="flex gap-4 justify-center">
            <Link to="/dashboard/customer">
              <Button size="lg">Go to Dashboard</Button>
            </Link>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <Card>
            <CardHeader>
              <CardTitle>Expert Consultations</CardTitle>
              <CardDescription>Connect with verified professionals</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Schedule 1-on-1 sessions, attend seminars, and learn from domain experts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live Video & Chat</CardTitle>
              <CardDescription>Real-time communication tools</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                HD video calls powered by LiveKit, with integrated messaging
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Flexible Payments</CardTitle>
              <CardDescription>Transparent pricing, no surprises</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Secure Stripe-powered payments with full transaction history
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

