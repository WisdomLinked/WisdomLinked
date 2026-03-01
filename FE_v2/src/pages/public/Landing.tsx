import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Video,
  MessageSquare,
  Calendar,
  CreditCard,
  Star,
  Users,
  Shield,
  Zap,
  Globe,
  CheckCircle,
} from "lucide-react";

// ── Static data ────────────────────────────────────────────────────────────

interface StatItem {
  readonly label: string;
  readonly target: number;
  readonly suffix: string;
  readonly decimals: number;
}

const STATS: readonly StatItem[] = [
  { label: "Consultations Served", target: 290, suffix: "k+", decimals: 0 },
  { label: "Expert Consultants", target: 1200, suffix: "+", decimals: 0 },
  { label: "Countries Reached", target: 45, suffix: "+", decimals: 0 },
  { label: "Avg Expert Rating", target: 4.9, suffix: "/5", decimals: 1 },
];

interface FeatureItem {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly title: string;
  readonly desc: string;
}

const FEATURES: readonly FeatureItem[] = [
  {
    icon: Video,
    title: "HD Video Calls",
    desc: "Crystal-clear one-on-one video consultations with screen sharing and recording.",
  },
  {
    icon: MessageSquare,
    title: "Direct Messaging",
    desc: "Secure messaging before and after your consultation sessions.",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    desc: "Book sessions in your timezone with instant calendar sync.",
  },
  {
    icon: CreditCard,
    title: "Secure Payments",
    desc: "Protected transactions with built-in tip and refund support.",
  },
  {
    icon: Shield,
    title: "Verified Experts",
    desc: "Every expert is vetted with credentials verified by our team.",
  },
  {
    icon: Globe,
    title: "Global Network",
    desc: "Access world-class experts from 45+ countries worldwide.",
  },
];

interface ExpertCard {
  readonly name: string;
  readonly title: string;
  readonly specialty: string;
  readonly rating: number;
  readonly sessions: number;
}

const EXPERT_CARDS: readonly ExpertCard[] = [
  {
    name: "Dr. Elena Kovacs",
    title: "Research Scientist",
    specialty: "AI & Machine Learning",
    rating: 5.0,
    sessions: 342,
  },
  {
    name: "Prof. James Harrington",
    title: "Stanford Professor",
    specialty: "Graduate Admissions",
    rating: 4.9,
    sessions: 518,
  },
  {
    name: "Mei Zhang, PhD",
    title: "Senior Engineer",
    specialty: "Career Abroad",
    rating: 4.8,
    sessions: 207,
  },
];

const BENEFITS: readonly string[] = [
  "No subscription — pay only for sessions you book",
  "Money-back guarantee if expert doesn't show",
  "Recorded sessions for quality assurance",
  "24/7 support from our customer success team",
];

// ── Stat counter hook (pure, deterministic) ────────────────────────────────

function useCounter(
  target: number,
  durationMs: number,
  active: boolean,
  decimals: number
): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;

    const steps = 60;
    const increment = target / steps;
    let step = 0;

    const timer = setInterval(() => {
      step += 1;
      const next = Math.min(target, increment * step);
      setValue(parseFloat(next.toFixed(decimals)));
      if (step >= steps) clearInterval(timer);
    }, durationMs / steps);

    return () => clearInterval(timer);
  }, [active, target, durationMs, decimals]);

  return value;
}

// ── StatCard component ─────────────────────────────────────────────────────

function StatCard({ label, target, suffix, decimals }: StatItem) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry !== undefined && entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const value = useCounter(target, 1500, visible, decimals);
  const display =
    decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString();

  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl font-bold text-primary">
        {display}
        {suffix}
      </div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

// ── Main Landing component ─────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="w-full">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative min-h-[88vh] flex items-center justify-center overflow-hidden bg-background">
        {/* Radial teal glow behind hero text */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 55% at 50% -5%, hsl(var(--primary) / 0.18), transparent 70%)",
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center py-20">
          <Badge
            className={cn(
              "mb-6 border",
              "bg-primary/10 text-primary border-primary/30"
            )}
          >
            The Global Consultation Marketplace
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            Talk With{" "}
            <span className="text-primary">World-Class</span>
            <br />
            Experts Today
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Connect with verified professors, scientists, engineers and managers
            from top institutions worldwide. Get authoritative advice on study
            abroad, careers, and research.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register/customer">
              <Button size="lg" className="text-base px-10 h-12">
                Get Started
              </Button>
            </Link>
            <Link to="/register/expert">
              <Button size="lg" variant="outline" className="text-base px-10 h-12">
                Become an Expert
              </Button>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {BENEFITS.map((b) => (
              <span key={b} className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <section className="py-16 bg-card border-y border-border">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Expert Showcase ───────────────────────────────────────── */}
      <section className="py-20 bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Meet Our Experts
            </h2>
            <p className="text-muted-foreground text-lg">
              Verified professionals with decades of real-world experience
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {EXPERT_CARDS.map((expert) => (
              <Card key={expert.name} className="card-hover overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                      {expert.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">
                        {expert.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {expert.title}
                      </div>
                    </div>
                  </div>

                  <Badge variant="secondary" className="mb-4 text-xs">
                    {expert.specialty}
                  </Badge>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                      <span className="font-medium">{expert.rating.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{expert.sessions.toLocaleString()} sessions</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link to="/services">
              <Button variant="outline" size="lg">
                Browse All Expert Categories
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Feature Grid ──────────────────────────────────────────── */}
      <section className="py-20 bg-card">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Everything You Need
            </h2>
            <p className="text-muted-foreground text-lg">
              A complete platform for premium consultations — from booking to
              payment
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="flex gap-4 p-5 rounded-xl bg-background/60 border border-border hover:border-primary/40 transition-colors duration-200"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm mb-1">{feat.title}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {feat.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────── */}
      <section className="py-24 bg-background">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6">
            <Zap className="h-7 w-7" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-muted-foreground text-lg mb-10">
            Join thousands of customers who found clarity through expert advice.
            Your first session is just a few clicks away.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register/customer">
              <Button size="lg" className="text-base px-10 h-12">
                Start as Customer
              </Button>
            </Link>
            <Link to="/register/expert">
              <Button size="lg" variant="outline" className="text-base px-10 h-12">
                Join as Expert
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
