import { Sparkles } from "lucide-react";

export function Header() {
  return (
    <header className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-2 sm:py-3 bg-bg-primary border-b border-border z-10">
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="flex items-center justify-center size-8">
          <Sparkles className="size-5 sm:size-6 text-pink" />
        </div>
        <h2 className="text-base sm:text-xl font-bold text-white tracking-tight">
          AI STUDIO
        </h2>
      </div>
    </header>
  );
}
