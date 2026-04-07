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
        "flex h-full flex-col gap-7 rounded-2xl border border-stone-200/70 bg-white px-6 py-7 shadow-sm ring-0 sm:gap-8 sm:px-8 sm:py-8 lg:px-9 lg:py-9",
        className
      )}
    >
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground tabular-nums">
          {String(item.number).padStart(2, "0")}
        </p>
      </div>

      <div className="flex flex-col gap-3.5 sm:gap-4.5">
        <h3 className="max-w-[14ch] text-2xl font-bold leading-[1.05] tracking-tight sm:text-3xl">
          {item.title}
        </h3>
        <p className="max-w-[34ch] font-mono text-sm leading-7 text-muted-foreground sm:text-base">
          {item.description}
        </p>
      </div>

      {isLive ? (
        <div className="mt-auto pt-3">
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
