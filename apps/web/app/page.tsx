import { DemoCard } from "@/components/demo-card";
import { DEMO_ITEMS } from "@/lib/demo-items";

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-stone-50 px-4 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-14 lg:px-12 lg:pb-28 xl:px-16 2xl:px-24">
      <main className="mx-auto w-full max-w-7xl">
        <h1 className="text-6xl font-extrabold tracking-tighter sm:text-7xl md:text-8xl">
          Skills lab
        </h1>

        <section
          aria-labelledby="demos-heading"
          className="mt-20 flex flex-col gap-16 sm:mt-28 sm:gap-20"
        >
          <h2
            id="demos-heading"
            className="text-5xl font-extrabold tracking-tight text-balance sm:text-6xl md:text-7xl"
          >
            Demos
          </h2>
          <ul className="grid list-none grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 xl:grid-cols-3 xl:gap-10">
            {DEMO_ITEMS.map((item) => (
              <li key={item.id}>
                <DemoCard item={item} className="h-full" />
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
