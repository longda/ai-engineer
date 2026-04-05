"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DemoItem } from "@/lib/demo-items";

type DemoCardProps = {
  item: DemoItem;
  className?: string;
};

export function DemoCard({ item, className }: DemoCardProps) {
  const isLive = item.status === "live" && item.href;

  return (
    <Card
      className={cn(
        "flex h-full flex-col gap-6 border-0 bg-white p-6 shadow-sm ring-0 sm:gap-8 sm:p-8 lg:p-10",
        className
      )}
    >
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground tabular-nums">
          {String(item.number).padStart(2, "0")}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:gap-4">
        <h3 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          {item.title}
        </h3>
        <p className="font-mono text-sm leading-relaxed text-muted-foreground sm:text-base">
          {item.description}
        </p>
      </div>

      {isLive ? (
        <div className="mt-auto pt-2">
          <Link
            href={item.href!}
            className={cn(
              buttonVariants({ variant: "secondary", size: "default" }),
              "h-auto gap-2 px-4 py-2.5 text-sm sm:text-base"
            )}
          >
            Open demo
            <ArrowUpRight data-icon="inline-end" />
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
