import ContextArchitectureClient from "./context-architecture-client";
import { getContextArchitectureFilterOptions } from "@/lib/context-architecture/server";

export default async function ContextArchitecturePage() {
  const filterOptions = await getContextArchitectureFilterOptions();

  return <ContextArchitectureClient filterOptions={filterOptions} />;
}