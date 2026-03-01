import { Star, MapPin } from "lucide-react";

import { type ExpertResult } from "@/api/searchApi";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ── Expert Card ────────────────────────────────────────────────────────────

export interface ExpertCardProps {
  expert: ExpertResult;
  onView: () => void;
  onBook: () => void;
}

export function ExpertCard({ expert, onView, onBook }: ExpertCardProps) {
  const minPrice =
    expert.price.length > 0 ? Math.min(...expert.price) : null;

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col space-y-3 py-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 shrink-0">
            {expert.image ? (
              <AvatarImage src={expert.image} alt={expert.username} />
            ) : null}
            <AvatarFallback>
              {expert.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{expert.username}</p>
            {expert.title && (
              <p className="truncate text-sm text-muted-foreground">
                {expert.title}
              </p>
            )}
            <div className="mt-0.5 flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-primary text-primary" />
              <span className="text-xs text-muted-foreground">
                {expert.rating.toFixed(1)}
              </span>
              {expert.city && (
                <>
                  <span className="text-xs text-muted-foreground">•</span>
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate text-xs text-muted-foreground">
                    {expert.city}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bio excerpt */}
        {expert.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {expert.description}
          </p>
        )}

        {/* Service badges */}
        {expert.services.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {expert.services.slice(0, 3).map((s) => (
              <Badge key={s._id} variant="secondary" className="text-xs">
                {s.name ?? s._id}
              </Badge>
            ))}
            {expert.services.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{expert.services.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Price */}
        {minPrice !== null && (
          <p className="text-sm font-medium text-primary">
            From ${minPrice}/hr
          </p>
        )}

        {/* CTAs */}
        <div className="mt-auto flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onView}
          >
            View Profile
          </Button>
          <Button size="sm" className="flex-1" onClick={onBook}>
            Book Session
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
