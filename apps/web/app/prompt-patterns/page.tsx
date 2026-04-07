"use client";

import { FormEvent, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type PromptPatternResponse = {
  zeroShot: string;
  fewShot: string;
  chainOfThought: string;
};

type ToolDemoResponse = {
  answer: string;
  toolCalls: Array<{ toolName: string; input: unknown }>;
};

export default function PromptPatternsPage() {
  const [comparisonPrompt, setComparisonPrompt] = useState(
    "Why do stars twinkle but planets don't?"
  );
  const [toolPrompt, setToolPrompt] = useState(
    "Count the words in this sentence and then multiply the count by 2: I love building AI features with TypeScript."
  );

  const [comparison, setComparison] = useState<PromptPatternResponse | null>(
    null
  );
  const [toolResult, setToolResult] = useState<ToolDemoResponse | null>(null);

  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [toolLoading, setToolLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRunComparison = useMemo(
    () => comparisonPrompt.trim().length > 0 && !comparisonLoading,
    [comparisonPrompt, comparisonLoading]
  );
  const canRunToolDemo = useMemo(
    () => toolPrompt.trim().length > 0 && !toolLoading,
    [toolPrompt, toolLoading]
  );

  async function runComparison(event: FormEvent) {
    event.preventDefault();
    if (!comparisonPrompt.trim()) return;

    setComparisonLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/prompt-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: comparisonPrompt.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to run prompt pattern comparison.");
        return;
      }

      setComparison(data);
    } catch {
      setError("Network error while running prompt pattern comparison.");
    } finally {
      setComparisonLoading(false);
    }
  }

  async function runToolDemo(event: FormEvent) {
    event.preventDefault();
    if (!toolPrompt.trim()) return;

    setToolLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tool-calling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: toolPrompt.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to run tool-calling demo.");
        return;
      }

      setToolResult(data);
    } catch {
      setError("Network error while running tool-calling demo.");
    } finally {
      setToolLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24 pt-12 sm:px-12 sm:pb-32 sm:pt-16 md:px-16 lg:px-24 xl:px-32">
        <header className="flex max-w-3xl flex-col gap-3">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Prompt pattern lab
          </h1>
        </header>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <Tabs defaultValue="comparison" className="flex w-full flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-lg font-semibold sm:text-xl">Workspace</h2>
            <TabsList
              variant="line"
              className="h-auto w-full max-w-md flex-wrap p-1 sm:w-auto"
            >
              <TabsTrigger value="comparison" className="flex-1 sm:flex-none">
                Comparison
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex-1 sm:flex-none">
                Tool calling
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="comparison" className="mt-0 outline-none">
            <Card className="border-0 bg-white shadow-sm ring-0">
              <CardHeader>
                <CardTitle>Zero-shot · Few-shot · Chain-of-thought</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 pt-6">
                <form onSubmit={runComparison} className="flex flex-col gap-4">
                  <Textarea
                    value={comparisonPrompt}
                    onChange={(event) => setComparisonPrompt(event.target.value)}
                    rows={5}
                    placeholder="Enter the same question for all prompt patterns..."
                    className="min-h-[120px] resize-y text-base leading-relaxed"
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" size="lg" disabled={!canRunComparison}>
                      {comparisonLoading ? "Running…" : "Run comparison"}
                    </Button>
                  </div>
                </form>

                {comparison ? (
                  <>
                    <div className="mt-2">
                      <h3 className="mb-4 text-base font-semibold">Outputs</h3>
                      <div className="grid gap-4 lg:grid-cols-3">
                        <Card className="border-0 bg-white shadow-sm ring-0">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                              Zero-shot
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap break-words">
                              {comparison.zeroShot}
                            </pre>
                          </CardContent>
                        </Card>
                        <Card className="border-0 bg-white shadow-sm ring-0">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                              Few-shot
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap break-words">
                              {comparison.fewShot}
                            </pre>
                          </CardContent>
                        </Card>
                        <Card className="border-0 bg-white shadow-sm ring-0 lg:col-span-1">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                              Chain-of-thought
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap break-words">
                              {comparison.chainOfThought}
                            </pre>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tools" className="mt-0 outline-none">
            <Card className="border-0 bg-white shadow-sm ring-0">
              <CardHeader>
                <CardTitle>Tool calling</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 pt-6">
                <form onSubmit={runToolDemo} className="flex flex-col gap-4">
                  <Input
                    value={toolPrompt}
                    onChange={(event) => setToolPrompt(event.target.value)}
                    placeholder="Ask something that could benefit from tools…"
                    className="h-11 text-base"
                  />
                  <Button type="submit" size="lg" disabled={!canRunToolDemo}>
                    {toolLoading ? "Running…" : "Run tool demo"}
                  </Button>
                </form>

                {toolResult ? (
                  <>
                    <div className="mt-2 flex flex-col gap-4">
                      <h3 className="text-base font-semibold sm:text-lg">Model answer</h3>
                      <Card className="border-0 bg-stone-100 shadow-none ring-0">
                        <CardContent className="pt-6">
                          <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {toolResult.answer}
                          </pre>
                        </CardContent>
                      </Card>
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-foreground">
                          Tools used
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {toolResult.toolCalls.length > 0 ? (
                            toolResult.toolCalls.map((toolCall, index) => (
                              <Badge
                                key={`${toolCall.toolName}-${index}`}
                                variant="secondary"
                                className="rounded-md font-mono text-xs font-normal"
                              >
                                {toolCall.toolName}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline" className="rounded-md">
                              No tool calls
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </main>
  );
}
