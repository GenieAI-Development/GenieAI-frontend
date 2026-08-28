import type { ReactNode } from "react";

export function GenieShell({ header, navigation, children, composer, overlays }: { header: ReactNode; navigation: ReactNode; children: ReactNode; composer: ReactNode; overlays?: ReactNode }) {
  return (
    <main className="genie-shell grid h-dvh w-screen grid-cols-1 grid-rows-[64px_minmax(0,1fr)] overflow-hidden bg-[#FAF7F1] text-[#16202B] md:grid-cols-[84px_minmax(0,1fr)]">
      <div className="col-span-full row-start-1">{header}</div>
      <div className="col-start-1 row-start-2 min-h-0 md:h-[calc(100dvh-64px)]">{navigation}</div>
      <section className="col-start-1 row-start-2 flex min-h-0 min-w-0 flex-col pb-[62px] md:col-start-2 md:pb-0">
        <div className="min-h-0 flex-1">{children}</div>
        {composer}
      </section>
      {overlays}
    </main>
  );
}
