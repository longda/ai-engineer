declare module "wink-bm25-text-search" {
  type Bm25Config = {
    fldWeights: Record<string, number>;
  };

  type PrepTask = (value: string) => string[];

  type Bm25Engine = {
    defineConfig(config: Bm25Config): void;
    definePrepTasks(tasks: PrepTask[], field?: string): number;
    addDoc(doc: Record<string, string>, uniqueId: string): void;
    consolidate(fp?: number): void;
    search(text: string, limit?: number): Array<[string, number]>;
  };

  export default function bm25(): Bm25Engine;
}