import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export default function FormControlsDemo() {
  const [checkboxChecked, setCheckboxChecked] = React.useState(false);
  const [switchEnabled, setSwitchEnabled] = React.useState(false);
  const [radioValue, setRadioValue] = React.useState("option-one");

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-foreground">Form Controls</h2>

      {/* Label */}
      <Card>
        <CardHeader>
          <CardTitle>Label</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="label-demo-input">Default label</Label>
            <Input id="label-demo-input" placeholder="Paired with a label" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="label-demo-disabled">Disabled peer</Label>
            <Input id="label-demo-disabled" disabled placeholder="Disabled input" />
          </div>
        </CardContent>
      </Card>

      {/* Textarea */}
      <Card>
        <CardHeader>
          <CardTitle>Textarea</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="textarea-default">Default</Label>
            <Textarea id="textarea-default" placeholder="Type something here…" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="textarea-disabled">Disabled</Label>
            <Textarea id="textarea-disabled" disabled placeholder="Cannot be edited" />
          </div>
        </CardContent>
      </Card>

      {/* Checkbox */}
      <Card>
        <CardHeader>
          <CardTitle>Checkbox</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="checkbox-interactive"
              checked={checkboxChecked}
              onCheckedChange={(checked) => setCheckboxChecked(checked === true)}
            />
            <Label htmlFor="checkbox-interactive">
              {checkboxChecked ? "Checked" : "Unchecked"} — click to toggle
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="checkbox-default-checked" defaultChecked />
            <Label htmlFor="checkbox-default-checked">Checked by default</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="checkbox-disabled-off" disabled />
            <Label htmlFor="checkbox-disabled-off">Disabled unchecked</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="checkbox-disabled-on" disabled defaultChecked />
            <Label htmlFor="checkbox-disabled-on">Disabled checked</Label>
          </div>
        </CardContent>
      </Card>

      {/* Switch */}
      <Card>
        <CardHeader>
          <CardTitle>Switch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              id="switch-interactive"
              checked={switchEnabled}
              onCheckedChange={setSwitchEnabled}
            />
            <Label htmlFor="switch-interactive">
              {switchEnabled ? "On" : "Off"} — click to toggle
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="switch-default-on" defaultChecked />
            <Label htmlFor="switch-default-on">On by default</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="switch-disabled-off" disabled />
            <Label htmlFor="switch-disabled-off">Disabled off</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="switch-disabled-on" disabled defaultChecked />
            <Label htmlFor="switch-disabled-on">Disabled on</Label>
          </div>
        </CardContent>
      </Card>

      {/* Radio Group */}
      <Card>
        <CardHeader>
          <CardTitle>Radio Group</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="mb-1 block">Select an option</Label>
            <RadioGroup value={radioValue} onValueChange={setRadioValue} className="space-y-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="option-one" id="radio-one" />
                <Label htmlFor="radio-one">Option One</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="option-two" id="radio-two" />
                <Label htmlFor="radio-two">Option Two</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="option-three" id="radio-three" />
                <Label htmlFor="radio-three">Option Three</Label>
              </div>
            </RadioGroup>
            <p className="text-sm text-muted-foreground">Selected: {radioValue}</p>
          </div>
          <div className="space-y-2">
            <Label className="mb-1 block">Disabled radio group</Label>
            <RadioGroup defaultValue="option-one" className="space-y-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="option-one" id="radio-dis-one" disabled />
                <Label htmlFor="radio-dis-one">Option One</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="option-two" id="radio-dis-two" disabled />
                <Label htmlFor="radio-dis-two">Option Two</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
