import Head from 'next/head';
import Link from 'next/link';

export default function GamesPage() {
  return (
    <>
      <Head>
        <title>Games | Lahazaat</title>
        <meta name="description" content="Games and interactive features from Lahazaat." />
      </Head>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <header className="glass-panel rounded-[2.5rem] px-8 py-9">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-sky-600">
            Interactive
          </p>
          <h1 className="soft-title mt-3 text-[3.2rem] font-semibold">
            Games
          </h1>
          <p className="mt-3 max-w-2xl text-[0.98rem] leading-7 text-slate-400">
            This section is reserved for games and interactive experiences. Add your game modules
            here when they are ready.
          </p>
        </header>

        <section className="glass-card rounded-[2rem] border-dashed p-8 text-slate-500">
          <div className="flex flex-col gap-4">
            <p>Games available in this build:</p>
            <Link
              href="/games/wordle"
              className="inline-flex w-fit rounded-full bg-[linear-gradient(180deg,#ffffff_0%,#eff4fb_100%)] px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(148,163,184,0.22)] hover:-translate-y-0.5"
            >
              Open Wordle
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
