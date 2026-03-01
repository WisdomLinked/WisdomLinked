import { ThemeToggle } from "@/components/ui/ThemeToggle";
import FormControlsDemo from "./FormControlsDemo";
import DisplayFeedbackDemo from "./DisplayFeedbackDemo";
import OverlaysNavigationDemo from "./OverlaysNavigationDemo";
import ComplexInputsDemo from "./ComplexInputsDemo";

export default function DesignSystem() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-5xl px-6 py-10 space-y-16">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Design System</h1>
            <p className="mt-2 text-muted-foreground">
              Component showcase — toggle themes to see everything adapt.
            </p>
          </div>
          <ThemeToggle />
        </div>

        <hr className="border-border" />

        {/* All demo sections */}
        <FormControlsDemo />
        <hr className="border-border" />
        <DisplayFeedbackDemo />
        <hr className="border-border" />
        <OverlaysNavigationDemo />
        <hr className="border-border" />
        <ComplexInputsDemo />
      </div>
    </div>
  );
}
