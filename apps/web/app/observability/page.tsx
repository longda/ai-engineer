import { getObservabilityDashboard } from "@/lib/observability/braintrust";
import {
  isObservabilityRange,
  type ObservabilityDashboardData,
  type ObservabilityRange,
} from "@/lib/observability/types";
import { ObservabilityClient } from "./observability-client";

export const dynamic = "force-dynamic";

const DEFAULT_RANGE: ObservabilityRange = "7d";

type ObservabilityPageProps = {
  searchParams?: Promise<{
    range?: string;
  }>;
};

export default async function ObservabilityPage({
  searchParams,
}: ObservabilityPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedRange = resolvedSearchParams?.range;
  const range = isObservabilityRange(requestedRange)
    ? requestedRange
    : DEFAULT_RANGE;

  let dashboard: ObservabilityDashboardData | null = null;
  let errorMessage: string | null = null;

  try {
    dashboard = await getObservabilityDashboard(range);
  } catch (error) {
    console.error("Failed to load observability dashboard", {
      range,
      error,
    });
    errorMessage =
      "The observability dashboard could not be loaded. Please try again later.";
  }

  return (
    <ObservabilityClient
      dashboard={dashboard}
      errorMessage={errorMessage}
      selectedRange={range}
    />
  );
}