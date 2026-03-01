import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SCROLL_ITEMS = Array.from({ length: 20 }, (_, i) => i + 1);

export default function DisplayFeedbackDemo(): React.JSX.Element {
  return (
    <TooltipProvider>
      <div className="space-y-8 p-8">
        <h2 className="text-2xl font-bold">Display &amp; Feedback</h2>

        {/* Avatar Section */}
        <Card>
          <CardHeader>
            <CardTitle>Avatar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-6">
            {/* Small */}
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://github.com/shadcn.png" alt="Small avatar with image" />
                <AvatarFallback>SM</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">Small (image)</span>
            </div>
            {/* Medium default */}
            <div className="flex flex-col items-center gap-2">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" alt="Medium avatar with image" />
                <AvatarFallback>MD</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">Medium (image)</span>
            </div>
            {/* Large */}
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-14 w-14">
                <AvatarImage src="https://github.com/shadcn.png" alt="Large avatar with image" />
                <AvatarFallback>LG</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">Large (image)</span>
            </div>
            {/* Fallback initials */}
            <div className="flex flex-col items-center gap-2">
              <Avatar>
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">Fallback initials</span>
            </div>
          </CardContent>
        </Card>

        {/* Badge Section */}
        <Card>
          <CardHeader>
            <CardTitle>Badge</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </CardContent>
        </Card>

        {/* Skeleton Section */}
        <Card>
          <CardHeader>
            <CardTitle>Skeleton</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar + text loading state */}
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[150px]" />
              </div>
            </div>
            {/* Card body loading state */}
            <Skeleton className="h-32 w-full rounded-lg" />
            {/* Text lines */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-[75%]" />
            </div>
          </CardContent>
        </Card>

        {/* Separator Section */}
        <Card>
          <CardHeader>
            <CardTitle>Separator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-3">Horizontal</p>
              <Separator />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-3">Vertical</p>
              <div className="flex h-8 items-center gap-4">
                <span className="text-sm">Item A</span>
                <Separator orientation="vertical" />
                <span className="text-sm">Item B</span>
                <Separator orientation="vertical" />
                <span className="text-sm">Item C</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tooltip Section */}
        <Card>
          <CardHeader>
            <CardTitle>Tooltip</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="rounded border px-3 py-1 text-sm hover:bg-accent">
                  Top
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Tooltip on top</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="rounded border px-3 py-1 text-sm hover:bg-accent">
                  Bottom
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Tooltip on bottom</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="rounded border px-3 py-1 text-sm hover:bg-accent">
                  Left
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Tooltip on left</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="rounded border px-3 py-1 text-sm hover:bg-accent">
                  Right
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Tooltip on right</TooltipContent>
            </Tooltip>
          </CardContent>
        </Card>

        {/* ScrollArea Section */}
        <Card>
          <CardHeader>
            <CardTitle>ScrollArea</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">Vertical scroll</p>
              <ScrollArea className="h-48 w-full rounded-md border p-4">
                <div className="space-y-1">
                  {SCROLL_ITEMS.map((n) => (
                    <div key={n} className="text-sm py-1.5 border-b border-border/50 last:border-0">
                      Item {n} — scrollable content row
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-3">Horizontal scroll</p>
              <ScrollArea className="w-full rounded-md border p-4">
                <div className="flex gap-4 pb-2" style={{ width: "max-content" }}>
                  {SCROLL_ITEMS.map((n) => (
                    <div
                      key={n}
                      className="flex-shrink-0 w-28 h-20 rounded-md bg-muted flex items-center justify-center text-sm font-medium"
                    >
                      Card {n}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
