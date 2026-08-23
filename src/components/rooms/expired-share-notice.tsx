import { LinkIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export function ExpiredShareNotice() {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-24">
      <EmptyState
        icon={<LinkIcon />}
        title="This link is no longer active"
        description="The owner has revoked access, the link has expired, or the item was deleted. Ask whoever shared it with you for a new link."
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link href="/login">Sign in to Vault</Link>
          </Button>
        }
        className="border border-dashed border-border"
      />
    </div>
  );
}
