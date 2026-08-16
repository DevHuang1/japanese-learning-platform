"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  BookOpenText,
  BrainCircuit,
  FileSearch,
  Languages,
  ClipboardCheck,
} from "lucide-react";
import { GlossText } from "@/components/GlossText";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/reader", label: "Reader", icon: BookOpenText },
  { href: "/quiz", label: "AI Quiz", icon: BrainCircuit },
  { href: "/vocabulary", label: "Vocabulary", icon: Languages },
  { href: "/reviews", label: "Reviews", icon: ClipboardCheck },
  { href: "/ingest", label: "PDF Ingest", icon: FileSearch },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="paper-texture min-h-screen">
      <div className="torii-bar" />
      <div className="flex flex-col md:flex-row">
        <aside className="md:w-60 md:min-h-[calc(100vh-4px)] bg-indigo-dark text-paper/90 flex md:flex-col border-b md:border-b-0 md:border-r border-white/10">
          <div className="hidden md:flex items-center gap-3 px-6 py-6 border-b border-white/10">
            <div className="w-9 h-9 rounded-full bg-crimson flex items-center justify-center text-paper text-lg font-bold shadow-lg shadow-crimson/30">
              <GlossText>和</GlossText>
            </div>
            <div>
              <div className="font-jp text-lg leading-none tracking-wide"><GlossText>和学</GlossText></div>
              <div className="text-[11px] text-paper/75 mt-1">Wagaku · JLPT Study</div>
            </div>
          </div>

          <nav className="flex md:flex-col gap-1 overflow-x-auto px-2 py-3 md:p-3 md:flex-1">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "bg-crimson text-paper shadow-md shadow-crimson/30"
                      : "text-paper/70 hover:text-paper hover:bg-white/10"
                  }`}
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:block px-6 py-5 border-t border-white/10 text-[11px] text-paper/75 leading-relaxed">
            JLPT N5 · N4
            <br />
            Local-first · Personal
          </div>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
