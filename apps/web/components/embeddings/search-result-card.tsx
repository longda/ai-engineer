import { ArrowUpRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SemanticSearchResult } from "@/lib/embeddings/types";

function formatSourceType(value: string) {
  return value.replace(/_/g, " ");
}

function createChunkPreview(value: string) {
  const flattened = value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#>*`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (flattened.length <= 420) {
    return flattened;
  }

  return `${flattened.slice(0, 417).trimEnd()}...`;
}

export function SearchResultCard({ result }: { result: SemanticSearchResult }) {
  const preview = createChunkPreview(result.chunkText);

  return (
    <Card className="border border-stone-200/70 bg-white py-0 shadow-none">
      <CardHeader className="gap-3 border-b border-stone-100 pb-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-stone-100 text-stone-700">
            {formatSourceType(result.metadata.sourceType)}
          </Badge>
          <Badge variant="outline">{result.metadata.contentType}</Badge>
          <Badge variant="outline">score {result.score.toFixed(3)}</Badge>
        </div>
        <div className="flex flex-col gap-2">
          <CardTitle className="text-lg font-semibold tracking-tight">
            {result.metadata.title}
          </CardTitle>
          <a
            href={result.metadata.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Open source
            <ArrowUpRightIcon className="size-4" />
          </a>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4 py-4">
        <div className="flex flex-wrap gap-2">
          {result.metadata.entityNames.map((entityName) => (
            <Badge key={entityName} variant="outline">
              {entityName}
            </Badge>
          ))}
          {result.metadata.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="ghost" className="bg-stone-50 text-stone-600">
              {tag}
            </Badge>
          ))}
        </div>
        <p className="text-sm leading-6 text-foreground/90">{preview}</p>
      </CardContent>
    </Card>
  );
}