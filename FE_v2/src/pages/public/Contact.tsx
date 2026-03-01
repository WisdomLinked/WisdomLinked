import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Mail, MessageSquare, CheckCircle, Send } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface ContactFormState {
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly message: string;
}

interface FormErrors {
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly message: string;
}

const EMPTY_FORM: ContactFormState = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

const EMPTY_ERRORS: FormErrors = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateForm(form: ContactFormState): FormErrors {
  const errors = {
    name: form.name.trim().length < 3 ? "Name must be at least 3 characters." : "",
    email: !isValidEmail(form.email) ? "Please enter a valid email address." : "",
    subject: form.subject.trim().length < 3 ? "Subject is required." : "",
    message:
      form.message.trim().length < 10
        ? "Message must be at least 10 characters."
        : "",
  };
  return errors;
}

function hasErrors(errors: FormErrors): boolean {
  return Object.values(errors).some((e) => e.length > 0);
}

// ── Main Contact component ─────────────────────────────────────────────────

export default function Contact() {
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>(EMPTY_ERRORS);
  const [touched, setTouched] = useState<Record<keyof ContactFormState, boolean>>({
    name: false,
    email: false,
    subject: false,
    message: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  function handleChange(field: keyof ContactFormState, value: string): void {
    const updated = { ...form, [field]: value };
    setForm(updated);
    if (touched[field]) {
      const newErrors = validateForm(updated);
      setErrors((prev) => ({ ...prev, [field]: newErrors[field] }));
    }
  }

  function handleBlur(field: keyof ContactFormState): void {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const newErrors = validateForm(form);
    setErrors((prev) => ({ ...prev, [field]: newErrors[field] }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();

    const allTouched: Record<keyof ContactFormState, boolean> = {
      name: true,
      email: true,
      subject: true,
      message: true,
    };
    setTouched(allTouched);

    const newErrors = validateForm(form);
    setErrors(newErrors);

    if (hasErrors(newErrors)) return;

    setIsSubmitting(true);

    try {
      // Simulate network request — replace with actual API call when backend supports it
      await new Promise<void>((resolve) => setTimeout(resolve, 900));

      setIsSuccess(true);
      setForm(EMPTY_FORM);
      setErrors(EMPTY_ERRORS);
      setTouched({ name: false, email: false, subject: false, message: false });

      if (window.toast) {
        window.toast({
          title: "Message Sent",
          description: "Thank you! We'll get back to you within 5 business days.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 py-20 bg-background">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Message Received!</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Thank you for reaching out. Our team will review your message and
            get back to you within 5 business days.
          </p>
          <Button onClick={() => setIsSuccess(false)} variant="outline">
            Send Another Message
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="py-16 bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-5">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-bold mb-3">Contact Us</h1>
          <p className="text-muted-foreground text-lg">
            Have a question or issue? We'd love to hear from you.
          </p>
        </div>
      </section>

      {/* ── Contact Form ──────────────────────────────────────────── */}
      <section className="py-20 bg-background">
        <div className="max-w-3xl mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-10">
            {/* Side info */}
            <div className="lg:col-span-1 space-y-6">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold mb-1">Email</div>
                  <div className="text-xs text-muted-foreground">
                    support@wisdomlinked.com
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold mb-1">Response Time</div>
                  <div className="text-xs text-muted-foreground">
                    Within 5 business days
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="p-8">
                  <form onSubmit={handleSubmit} noValidate className="space-y-6">
                    {/* Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="name">
                        Full Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Your full name"
                        value={form.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        onBlur={() => handleBlur("name")}
                        className={cn(
                          touched.name && errors.name ? "border-destructive" : ""
                        )}
                      />
                      {touched.name && errors.name && (
                        <p className="text-xs text-destructive">{errors.name}</p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <Label htmlFor="email">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        onBlur={() => handleBlur("email")}
                        className={cn(
                          touched.email && errors.email ? "border-destructive" : ""
                        )}
                      />
                      {touched.email && errors.email && (
                        <p className="text-xs text-destructive">{errors.email}</p>
                      )}
                    </div>

                    {/* Subject */}
                    <div className="space-y-1.5">
                      <Label htmlFor="subject">
                        Subject <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="subject"
                        type="text"
                        placeholder="Brief subject line"
                        value={form.subject}
                        onChange={(e) => handleChange("subject", e.target.value)}
                        onBlur={() => handleBlur("subject")}
                        className={cn(
                          touched.subject && errors.subject
                            ? "border-destructive"
                            : ""
                        )}
                      />
                      {touched.subject && errors.subject && (
                        <p className="text-xs text-destructive">{errors.subject}</p>
                      )}
                    </div>

                    {/* Message */}
                    <div className="space-y-1.5">
                      <Label htmlFor="message">
                        Message <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="message"
                        placeholder="Describe your question or issue in detail..."
                        rows={6}
                        value={form.message}
                        onChange={(e) => handleChange("message", e.target.value)}
                        onBlur={() => handleBlur("message")}
                        className={cn(
                          "resize-none",
                          touched.message && errors.message
                            ? "border-destructive"
                            : ""
                        )}
                      />
                      {touched.message && errors.message && (
                        <p className="text-xs text-destructive">{errors.message}</p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        "Sending..."
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
