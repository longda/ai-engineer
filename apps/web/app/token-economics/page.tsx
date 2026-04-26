import { getCuratedTokenEconomicsModels } from "@/lib/token-economics/catalog";
import { TokenEconomicsClient } from "./token-economics-client";

export default async function TokenEconomicsPage() {
  const initialModels = await getCuratedTokenEconomicsModels();

  return <TokenEconomicsClient initialModels={initialModels} />;
}