export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">RepoPulse Lite</h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-md text-center">
        Deterministic GitHub repository health scoring with an LLM executive
        audit. Paste any public repository URL to analyze its pulse.
      </p>
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 text-sm text-neutral-500">
        Dashboard coming in Phase 3 — backend ingestion lands in Phase 1.
      </div>
    </main>
  );
}
