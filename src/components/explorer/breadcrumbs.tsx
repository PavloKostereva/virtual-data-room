"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { folderHref, useScope } from "@/components/providers/scope-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { BreadcrumbDto } from "@/types/dto";

interface BreadcrumbsProps {
  items: BreadcrumbDto[];
  className?: string;
}

const MAX_VISIBLE_CRUMBS = 4;

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const scope = useScope();

  const { leading, collapsed, trailing } = useMemo(() => {
    if (items.length <= MAX_VISIBLE_CRUMBS) {
      return { leading: items, collapsed: [] as BreadcrumbDto[], trailing: [] as BreadcrumbDto[] };
    }
    return {
      leading: items.slice(0, 1),
      collapsed: items.slice(1, items.length - 2),
      trailing: items.slice(items.length - 2),
    };
  }, [items]);

  const renderCrumb = (crumb: BreadcrumbDto, index: number, isLast: boolean) => (
    <li key={crumb.id} className="flex min-w-0 items-center gap-1">
      {index > 0 || leading.length === 0 ? (
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
      ) : null}
      {isLast ? (
        <span className="truncate text-sm font-medium text-foreground" aria-current="page">
          {crumb.name}
        </span>
      ) : (
        <Link
          href={folderHref(scope, crumb.id)}
          className="truncate rounded-xs px-1 py-0.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {crumb.name}
        </Link>
      )}
    </li>
  );

  const lastId = items[items.length - 1]?.id;

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1">
        {leading.map((crumb, index) =>
          renderCrumb(crumb, index, crumb.id === lastId),
        )}

        {collapsed.length > 0 ? (
          <li className="flex items-center gap-1">
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
            <DropdownMenu>
              <DropdownMenuTrigger
                className="rounded-xs px-1.5 py-0.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Show ${collapsed.length} hidden folders`}
              >
                …
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {collapsed.map((crumb) => (
                  <DropdownMenuItem key={crumb.id} asChild>
                    <Link href={folderHref(scope, crumb.id)}>{crumb.name}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ) : null}

        {trailing.map((crumb, index) => renderCrumb(crumb, index + 1, crumb.id === lastId))}
      </ol>
    </nav>
  );
}
