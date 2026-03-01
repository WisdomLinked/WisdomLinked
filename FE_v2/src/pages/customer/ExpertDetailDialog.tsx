import { MapPin, MessageSquare, Star } from "lucide-react";

import { type ExpertResult } from "@/api/searchApi";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

// ── Expert Detail Dialog ───────────────────────────────────────────────────

export interface ExpertDetailDialogProps {
  expert: ExpertResult | null;
  onClose: () => void;
  onMessage: () => void;
}

export function ExpertDetailDialog({
  expert,
  onClose,
  onMessage,
}: ExpertDetailDialogProps) {
  return (
    <Dialog open={expert !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        {expert !== null && (
          <>
            <DialogHeader>
              <DialogTitle>Expert Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {expert.image ? (
                    <AvatarImage src={expert.image} alt={expert.username} />
                  ) : null}
                  <AvatarFallback className="text-xl">
                    {expert.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold">{expert.username}</p>
                  {expert.title && (
                    <p className="text-sm text-muted-foreground">
                      {expert.title}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {expert.rating.toFixed(1)} rating
                    </span>
                  </div>
                </div>
              </div>

              {expert.description && (
                <>
                  <Separator />
                  <p className="text-sm text-muted-foreground">
                    {expert.description}
                  </p>
                </>
              )}

              {expert.services.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-2 text-sm font-medium">Specializations</p>
                    <div className="flex flex-wrap gap-1.5">
                      {expert.services.map((s) => (
                        <Badge key={s._id} variant="secondary">
                          {s.name ?? s._id}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {(expert.city ?? expert.country) && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {[expert.city, expert.country].filter(Boolean).join(", ")}
                </div>
              )}

              {expert.price.length > 0 && (
                <p className="text-sm font-medium text-primary">
                  From ${Math.min(...expert.price)}/hr
                </p>
              )}

              <Button className="w-full" onClick={onMessage}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Message Expert to Book
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
