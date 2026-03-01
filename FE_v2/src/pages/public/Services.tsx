import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  GraduationCap,
  Microscope,
  Briefcase,
  Globe,
  BookOpen,
  TrendingUp,
  Clock,
  DollarSign,
  CalendarCheck,
  ChevronRight,
} from "lucide-react";

// ── Static data ────────────────────────────────────────────────────────────

interface ServiceCategory {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly title: string;
  readonly description: string;
  readonly examples: readonly string[];
  readonly badge: string;
}

const SERVICE_CATEGORIES: readonly ServiceCategory[] = [
  {
    icon: GraduationCap,
    title: "Study Abroad",
    description:
      "Get expert guidance on graduate school applications, program selection, and navigating academia in the western world.",
    examples: [
      "PhD application strategy",
      "Research statement review",
      "School selection advice",
      "Scholarship guidance",
    ],
    badge: "Most Popular",
  },
  {
    icon: Microscope,
    title: "Scientific Research",
    description:
      "Connect with active researchers for advice on methodology, publication, collaboration, and career progression in academia.",
    examples: [
      "Research direction advice",
      "Paper review & feedback",
      "Lab collaboration",
      "Grant writing tips",
    ],
    badge: "Expert-Led",
  },
  {
    icon: Briefcase,
    title: "International Careers",
    description:
      "Learn how to find, apply for, and succeed at jobs in the western world from professionals who've done it.",
    examples: [
      "Resume & CV review",
      "Interview preparation",
      "Visa & work permit",
      "Salary negotiation",
    ],
    badge: "High Demand",
  },
  {
    icon: TrendingUp,
    title: "Industry Insights",
    description:
      "Get inside knowledge on specific industries, companies, and roles from senior professionals currently working in them.",
    examples: [
      "Industry landscape overview",
      "Company culture insights",
      "Career path planning",
      "Networking strategies",
    ],
    badge: "Professional",
  },
  {
    icon: BookOpen,
    title: "Academic Guidance",
    description:
      "From course selection to thesis defense, get support at every stage of your academic journey.",
    examples: [
      "Thesis/dissertation advice",
      "Course selection",
      "Academic writing",
      "Qualifying exam prep",
    ],
    badge: "Academic",
  },
  {
    icon: Globe,
    title: "Life Abroad",
    description:
      "Practical advice from people who made the move — covering everything from housing to cultural adjustment.",
    examples: [
      "City & housing advice",
      "Cultural adjustment",
      "Banking & finance",
      "Community finding",
    ],
    badge: "Practical",
  },
];

interface HowItWorksStep {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly step: string;
  readonly title: string;
  readonly desc: string;
}

const HOW_IT_WORKS: readonly HowItWorksStep[] = [
  {
    icon: GraduationCap,
    step: "01",
    title: "Browse & Select",
    desc: "Explore expert profiles, read reviews, and find the specialist that matches your needs.",
  },
  {
    icon: CalendarCheck,
    step: "02",
    title: "Book a Time Slot",
    desc: "Choose from the expert's available slots and book your session in your local timezone.",
  },
  {
    icon: DollarSign,
    step: "03",
    title: "Pay & Confirm",
    desc: "Pay securely upfront at the expert's asking price. Add a tip for exceptional value.",
  },
  {
    icon: Clock,
    step: "04",
    title: "Attend Your Session",
    desc: "Connect via HD video or audio at the appointed time and get the advice you need.",
  },
];

// ── Main Services component ────────────────────────────────────────────────

export default function Services() {
  return (
    <div className="w-full">
      {/* ── Hero ──────────────────────────────────────────────────── */}
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
            Uncommon Quality,
            <br />
            <span className="text-primary">Undeniable Value</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Expert consulting across study abroad, scientific research,
            international careers, and more — all appointment-based and paid
            securely upfront.
          </p>
        </div>
      </section>

      {/* ── Service Categories ────────────────────────────────────── */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Service Categories</h2>
            <p className="text-muted-foreground">
              Find exactly the expertise you need
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Card
                  key={cat.title}
                  className="card-hover group overflow-hidden"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Icon className="h-6 w-6" />
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {cat.badge}
                      </Badge>
                    </div>
                    <CardTitle className="text-base">{cat.title}</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      {cat.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <ul className="space-y-1.5">
                      {cat.examples.map((ex) => (
                        <li
                          key={ex}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <ChevronRight className="h-3 w-3 text-primary flex-shrink-0" />
                          {ex}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <Separator />

      {/* ── How It Works ──────────────────────────────────────────── */}
      <section className="py-20 bg-card">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">How It Works</h2>
            <p className="text-muted-foreground">
              Appointment-based service — straightforward from booking to
              session
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4 relative">
                    <Icon className="h-7 w-7" />
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {step.step}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm mb-2">{step.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="py-20 bg-background">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Find Your Expert</h2>
          <p className="text-muted-foreground mb-8">
            Registration is free. Browse experts and book your first session
            today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register/customer">
              <Button size="lg" className="px-10">
                Register as Customer
              </Button>
            </Link>
            <Link to="/register/expert">
              <Button size="lg" variant="outline" className="px-10">
                Join as Expert
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
