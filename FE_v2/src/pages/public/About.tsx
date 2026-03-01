import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Heart,
  Globe,
  ShieldCheck,
  Users,
  BookOpen,
  Lightbulb,
  Target,
  Award,
} from "lucide-react";

// ── Static data ────────────────────────────────────────────────────────────

interface ValueItem {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly title: string;
  readonly desc: string;
}

const VALUES: readonly ValueItem[] = [
  {
    icon: ShieldCheck,
    title: "Trust & Verification",
    desc: "Every expert undergoes rigorous credential verification before joining the platform.",
  },
  {
    icon: Globe,
    title: "Global Access",
    desc: "Breaking geographic barriers to connect curious minds with world-class experts.",
  },
  {
    icon: Heart,
    title: "Customer First",
    desc: "Your growth and satisfaction drive every decision we make.",
  },
  {
    icon: Lightbulb,
    title: "Knowledge Democratized",
    desc: "Elite expertise should be accessible to everyone, not just the privileged few.",
  },
  {
    icon: Users,
    title: "Community",
    desc: "Building a thriving ecosystem where experts and customers grow together.",
  },
  {
    icon: Award,
    title: "Excellence",
    desc: "We hold ourselves and our experts to the highest standards of quality.",
  },
];

interface TeamValue {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly heading: string;
  readonly body: string;
}

const TEAM_VALUES: readonly TeamValue[] = [
  {
    icon: BookOpen,
    heading: "Born from Academia",
    body:
      "WisdomLinked was founded by researchers who experienced first-hand how hard it is to get authoritative advice when navigating graduate school, career transitions, and cutting-edge research. We built the platform we wished we had.",
  },
  {
    icon: Target,
    heading: "Our Mission",
    body:
      "To make world-class expertise accessible to anyone, anywhere. A 30-minute conversation with the right expert can save you years of trial and error. We facilitate those conversations at scale.",
  },
  {
    icon: Globe,
    heading: "Where We Are Today",
    body:
      "With 1,200+ verified experts across 45+ countries and over 290,000 consultations served, WisdomLinked has become the premier platform for knowledge transfer between proven professionals and ambitious individuals.",
  },
];

// ── Main About component ───────────────────────────────────────────────────

export default function About() {
  return (
    <div className="w-full">
      {/* ── Hero Banner ───────────────────────────────────────────── */}
      <section className="relative py-24 bg-card overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 100%, hsl(var(--primary) / 0.12), transparent 70%)",
          }}
        />
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Connected to Knowledge
            <br />
            <span className="text-primary">Across the Globe</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Starting from study and work abroad — expanding to every domain
            where expert insight changes lives.
          </p>
        </div>
      </section>

      {/* ── Platform Story ────────────────────────────────────────── */}
      <section className="py-20 bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-8">
            {TEAM_VALUES.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.heading} className="border-border">
                  <CardContent className="p-8">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-5">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{item.heading}</h3>
                    <p className="text-muted-foreground leading-relaxed text-sm">
                      {item.body}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Mission Statement ─────────────────────────────────────── */}
      <section className="py-20 bg-card">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            What We Believe
          </h2>
          <blockquote className="text-2xl text-muted-foreground font-light italic leading-relaxed border-l-4 border-primary pl-6 text-left">
            "A 30-minute conversation with an authoritative expert through this
            platform could save clients years or months of effort — or countless
            dollars that could otherwise be wasted in darkness."
          </blockquote>
          <p className="mt-6 text-muted-foreground leading-relaxed">
            Our platform draws on the talents of elite professionals — top
            professors, scientists, researchers and senior industry leaders —
            who volunteer their time to share hard-won knowledge at a price they
            set themselves.
          </p>
        </div>
      </section>

      {/* ── Core Values Grid ──────────────────────────────────────── */}
      <section className="py-20 bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Our Core Values
            </h2>
            <p className="text-muted-foreground text-lg">
              The principles that guide every decision we make
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {VALUES.map((val) => {
              const Icon = val.icon;
              return (
                <div
                  key={val.title}
                  className="flex gap-4 p-6 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors duration-200"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm mb-1">{val.title}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {val.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
