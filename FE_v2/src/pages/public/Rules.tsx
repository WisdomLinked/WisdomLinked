import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  DollarSign,
  ShieldCheck,
  AlertCircle,
  Users,
  MessageSquare,
  Star,
  FileText,
} from "lucide-react";

// ── Static data ────────────────────────────────────────────────────────────

interface RuleItem {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly title: string;
  readonly body: string;
  readonly appliesTo: "both" | "customer" | "expert";
}

const RULES: readonly RuleItem[] = [
  {
    icon: Clock,
    title: "Appointment-Based Service",
    body: "The service is designed to be appointment-based. Clients shall not expect instant or on-demand services. All consultations must be scheduled in advance through the platform.",
    appliesTo: "both",
  },
  {
    icon: DollarSign,
    title: "Payment & Refund Policy",
    body: "An appointment is confirmed only after the client has paid at the expert's asking price plus a client-determined tip. Payment is non-refundable if the client does not show up. Payment is fully refundable if the expert fails to attend.",
    appliesTo: "both",
  },
  {
    icon: Users,
    title: "Expert Conduct",
    body: "Experts must arrive on time for scheduled appointments. Tardiness, no-shows, or substandard service quality may result in account suspension and refund obligations to the client.",
    appliesTo: "expert",
  },
  {
    icon: MessageSquare,
    title: "Respectful Communication",
    body: "All communication between experts and clients must remain professional and respectful. Harassment, discrimination, or inappropriate behavior of any kind is strictly prohibited.",
    appliesTo: "both",
  },
  {
    icon: AlertCircle,
    title: "Complaint Process",
    body: "Clients may file a complaint if service is not provided as arranged — including expert tardiness, system failures, or poor service quality. Management will investigate and respond within 5 business days.",
    appliesTo: "customer",
  },
  {
    icon: ShieldCheck,
    title: "Privacy & Confidentiality",
    body: "Conversations may be recorded for quality assurance purposes. Both parties consent to this recording by using the platform. All personal data is handled in accordance with our privacy policy.",
    appliesTo: "both",
  },
  {
    icon: Star,
    title: "Ratings & Reviews",
    body: "After each session, both parties may leave honest ratings and reviews. Fabricated, coerced, or retaliatory reviews violate our terms and may result in account termination.",
    appliesTo: "both",
  },
  {
    icon: FileText,
    title: "Platform Usage",
    body: "The platform may only be used for its intended purpose of facilitating legitimate professional consultations. Misuse, circumventing payments, or soliciting outside arrangements is forbidden.",
    appliesTo: "both",
  },
];

const APPLIES_TO_LABEL: Record<"both" | "customer" | "expert", string> = {
  both: "All Users",
  customer: "Customers",
  expert: "Experts",
};

const APPLIES_TO_VARIANT: Record<
  "both" | "customer" | "expert",
  "default" | "secondary" | "outline"
> = {
  both: "secondary",
  customer: "outline",
  expert: "default",
};

// ── Main Rules component ───────────────────────────────────────────────────

export default function Rules() {
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
            Rules for Both
            <br />
            <span className="text-primary">Experts and Clients</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Both experts and clients shall recognize the following rules
            regarding the services. These guidelines ensure a fair, safe, and
            productive experience for everyone.
          </p>
        </div>
      </section>

      {/* ── Rules List ────────────────────────────────────────────── */}
      <section className="py-20 bg-background">
        <div className="max-w-4xl mx-auto px-6">
          <div className="space-y-5">
            {RULES.map((rule, idx) => {
              const Icon = rule.icon;
              return (
                <Card key={rule.title} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mt-0.5">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <CardTitle className="text-base">{rule.title}</CardTitle>
                          <Badge variant={APPLIES_TO_VARIANT[rule.appliesTo]} className="text-xs">
                            {APPLIES_TO_LABEL[rule.appliesTo]}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pl-[3.5rem]">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {rule.body}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Footer Note ───────────────────────────────────────────── */}
      <section className="py-12 bg-card">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            These rules are subject to change. Users will be notified of
            significant updates. By using WisdomLinked you agree to abide by
            these guidelines and our full{" "}
            <span className="text-primary cursor-pointer hover:underline">
              Terms of Service
            </span>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
