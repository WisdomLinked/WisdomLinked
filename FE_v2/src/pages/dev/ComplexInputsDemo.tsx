import * as React from "react";

import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { MultiSelect } from "@/components/ui/multi-select";
import { PhoneInput } from "@/components/ui/phone-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Static demo data ──────────────────────────────────────────────────────

const SKILL_OPTIONS = [
  { value: "react", label: "React" },
  { value: "typescript", label: "TypeScript" },
  { value: "nodejs", label: "Node.js" },
  { value: "python", label: "Python" },
  { value: "graphql", label: "GraphQL" },
  { value: "docker", label: "Docker" },
  { value: "kubernetes", label: "Kubernetes" },
  { value: "aws", label: "AWS" },
  { value: "postgres", label: "PostgreSQL" },
  { value: "redis", label: "Redis" },
];

const CATEGORY_OPTIONS = [
  { value: "design", label: "UI/UX Design" },
  { value: "backend", label: "Backend Engineering" },
  { value: "frontend", label: "Frontend Engineering" },
  { value: "devops", label: "DevOps / Infrastructure" },
  { value: "mobile", label: "Mobile Development" },
  { value: "ml", label: "Machine Learning" },
  { value: "security", label: "Security" },
  { value: "product", label: "Product Management" },
];

// ── Demo page ─────────────────────────────────────────────────────────────

export default function ComplexInputsDemo() {
  // DatePicker state
  const [dateWithValue, setDateWithValue] = React.useState<Date | undefined>(
    new Date(2026, 2, 15), // March 15 2026
  );
  const [dateEmpty, setDateEmpty] = React.useState<Date | undefined>(undefined);
  const [dateDisabled] = React.useState<Date | undefined>(new Date(2026, 0, 1));

  // TimePicker state
  const [timeValue, setTimeValue] = React.useState<string | undefined>("09:30");
  const [timeEmpty, setTimeEmpty] = React.useState<string | undefined>(undefined);

  // MultiSelect state
  const [selectedSkills, setSelectedSkills] = React.useState<string[]>(["react", "typescript"]);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);

  // PhoneInput state
  const [phoneUS, setPhoneUS] = React.useState<string | undefined>(undefined);
  const [phoneIN, setPhoneIN] = React.useState<string | undefined>(undefined);
  const [phoneDE, setPhoneDE] = React.useState<string | undefined>(undefined);

  return (
    <div className="space-y-8 p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Complex Inputs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Interactive demos of date, time, multi-select, and phone input components.
        </p>
      </div>

      {/* ── DatePicker ── */}
      <Card>
        <CardHeader>
          <CardTitle>Date Picker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Pre-selected date</p>
            <DatePicker
              value={dateWithValue}
              onChange={setDateWithValue}
              className="max-w-xs"
            />
            {dateWithValue !== undefined && (
              <p className="text-xs text-muted-foreground">
                Selected: {dateWithValue.toDateString()}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Empty state</p>
            <DatePicker
              value={dateEmpty}
              onChange={setDateEmpty}
              placeholder="Choose a date…"
              className="max-w-xs"
            />
            {dateEmpty !== undefined && (
              <p className="text-xs text-muted-foreground">
                Selected: {dateEmpty.toDateString()}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Disabled</p>
            <DatePicker
              value={dateDisabled}
              disabled
              className="max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── TimePicker ── */}
      <Card>
        <CardHeader>
          <CardTitle>Time Picker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Pre-set time (09:30)</p>
            <TimePicker
              value={timeValue}
              onChange={setTimeValue}
              className="max-w-xs"
            />
            {timeValue !== undefined && (
              <p className="text-xs text-muted-foreground">Selected: {timeValue}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Empty state</p>
            <TimePicker
              value={timeEmpty}
              onChange={setTimeEmpty}
              className="max-w-xs"
            />
            {timeEmpty !== undefined && (
              <p className="text-xs text-muted-foreground">Selected: {timeEmpty}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Disabled</p>
            <TimePicker value="14:00" disabled className="max-w-xs" />
          </div>
        </CardContent>
      </Card>

      {/* ── MultiSelect ── */}
      <Card>
        <CardHeader>
          <CardTitle>Multi Select</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Skills (pre-selected)</p>
            <MultiSelect
              options={SKILL_OPTIONS}
              value={selectedSkills}
              onChange={setSelectedSkills}
              placeholder="Select skills…"
              className="max-w-md"
            />
            {selectedSkills.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedSkills.length} selected: {selectedSkills.join(", ")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Categories (empty, searchable)</p>
            <MultiSelect
              options={CATEGORY_OPTIONS}
              value={selectedCategories}
              onChange={setSelectedCategories}
              placeholder="Select categories…"
              className="max-w-md"
            />
            {selectedCategories.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedCategories.length} selected: {selectedCategories.join(", ")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Disabled</p>
            <MultiSelect
              options={SKILL_OPTIONS}
              value={["react", "typescript"]}
              placeholder="Disabled selector"
              disabled
              className="max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── PhoneInput ── */}
      <Card>
        <CardHeader>
          <CardTitle>Phone Input</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">United States (+1)</p>
            <PhoneInput
              value={phoneUS}
              onChange={setPhoneUS}
              defaultCountry="US"
              className="max-w-xs"
            />
            {phoneUS !== undefined && phoneUS.length > 0 && (
              <p className="text-xs text-muted-foreground">Value: {phoneUS}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">India (+91)</p>
            <PhoneInput
              value={phoneIN}
              onChange={setPhoneIN}
              defaultCountry="IN"
              className="max-w-xs"
            />
            {phoneIN !== undefined && phoneIN.length > 0 && (
              <p className="text-xs text-muted-foreground">Value: {phoneIN}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Germany (+49)</p>
            <PhoneInput
              value={phoneDE}
              onChange={setPhoneDE}
              defaultCountry="DE"
              className="max-w-xs"
            />
            {phoneDE !== undefined && phoneDE.length > 0 && (
              <p className="text-xs text-muted-foreground">Value: {phoneDE}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Disabled</p>
            <PhoneInput disabled defaultCountry="GB" className="max-w-xs" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
