import Link from "next/link";

const MODULES = [
  {
    group: "Configuration",
    items: [
      {
        href: "/configuration/business-config/company-profile",
        title: "Company Profile",
        description: "Company, business units, offices, warehouses and document terms.",
      },
    ],
  },
] as const;

export default function Home() {
  return (
    <main className="flex-1 bg-zinc-100 text-zinc-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">BridgeOne ERP</h1>
          <p className="text-sm text-zinc-600">Select a module to get started.</p>
        </header>
        {MODULES.map((module) => (
          <section key={module.group} className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{module.group}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {module.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block h-full rounded-lg border border-zinc-200 bg-white p-4 shadow-xs hover:border-blue-300 focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-zinc-600">{item.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
