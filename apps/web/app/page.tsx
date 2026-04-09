import { DemoCard } from "@/components/demo-card";
import { DEMO_ITEMS } from "@/lib/demo-items";

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-stone-50 px-5 pb-20 pt-12 sm:px-8 sm:pb-24 sm:pt-16 lg:px-12 lg:pb-28 xl:px-16 2xl:px-24">
      <main className="mx-auto w-full max-w-7xl">
        <h1 className="text-6xl font-extrabold tracking-tighter sm:text-7xl md:text-8xl">
          Skills lab
        </h1>

        <section
          aria-labelledby="demos-heading"
          className="mt-16 flex flex-col gap-10 pb-6 sm:mt-20 sm:gap-12 sm:pb-8 lg:mt-24 lg:gap-14 lg:pb-10"
        >
          <h2
            id="demos-heading"
            className="text-5xl font-extrabold tracking-tight text-balance sm:text-6xl md:text-7xl"
          >
            Demos
          </h2>
          <ul className="grid list-none grid-cols-1 gap-5 pb-2 sm:grid-cols-2 sm:gap-6 sm:pb-4 xl:grid-cols-3 xl:gap-8">
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
