import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  SlidersHorizontal,
  Download,
  Loader2,
  X,
  Sparkles,
  GitCompareArrows,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Trash2,
  ArrowUpDown,
  Grid2x2,
  Grid3x3,
  LayoutGrid,
  PanelLeftOpen,
} from "lucide-react";
import { MODELS } from "../models";
import { ImageCard } from "./ImageCard";

const ART_STYLES = ["none", "comic", "3d toon", "sketch", "pop art"] as const;

interface FilterState {
  engines: string[];
  styles: string[];
}

interface Generation {
  _id: string;
  prompt: string;
  engine: string;
  style: string;
  status: string;
  batchSize: number;
  imageUrls: string[];
  thumbnailUrls?: string[];
  originalUrls?: string[];
  _creationTime: number;
  error?: string;
}

interface GalleryProps {
  generations: Generation[];
  onDelete: (id: string) => void;
  onToggleSidebar: () => void;
}

function modelName(engineId: string) {
  return MODELS.find((m) => m.id === engineId)?.name ?? engineId;
}

function modelBadge(engineId: string) {
  return MODELS.find((m) => m.id === engineId)?.badge;
}

function BadgeTag({ badge }: { badge?: string }) {
  if (!badge) return null;
  const cls =
    badge === "PRO"
      ? "bg-gold/20 text-gold"
      : badge === "FAST"
        ? "bg-green/20 text-green"
        : "bg-pink/20 text-pink";
  return (
    <span
      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase leading-none ${cls}`}
    >
      {badge}
    </span>
  );
}

type GridSize = "small" | "medium" | "large";

const GRID_GAP_CLASSES: Record<GridSize, string> = {
  small: "gap-1.5 sm:gap-2",
  medium: "gap-2.5 sm:gap-3",
  large: "gap-3 sm:gap-5",
};

const GRID_CARD_WIDTH: Record<GridSize, number> = {
  small: 100,
  medium: 170,
  large: 280,
};

function gridTemplateStyle(size: GridSize) {
  const cardWidth = GRID_CARD_WIDTH[size];
  return {
    gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${cardWidth}px), ${cardWidth}px))`,
    justifyContent: "start" as const,
  };
}

type SortMode = "newest" | "oldest" | "prompt-az" | "prompt-za";

const GALLERY_PREFS_KEY = "ai-studio-gallery-preferences";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "prompt-az", label: "Prompt A-Z" },
  { value: "prompt-za", label: "Prompt Z-A" },
];

function isGridSize(value: unknown): value is GridSize {
  return value === "small" || value === "medium" || value === "large";
}

function isSortMode(value: unknown): value is SortMode {
  return (
    value === "newest" ||
    value === "oldest" ||
    value === "prompt-az" ||
    value === "prompt-za"
  );
}

function loadGalleryPreferences(): {
  gridSize: GridSize;
  sortMode: SortMode;
  filterState: FilterState;
} {
  const defaults = {
    gridSize: "medium" as GridSize,
    sortMode: "newest" as SortMode,
    filterState: { engines: [], styles: [] } as FilterState,
  };

  try {
    const raw = localStorage.getItem(GALLERY_PREFS_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as {
      gridSize?: unknown;
      sortMode?: unknown;
      filterState?: { engines?: unknown; styles?: unknown };
    };

    return {
      gridSize: isGridSize(parsed.gridSize)
        ? parsed.gridSize
        : defaults.gridSize,
      sortMode: isSortMode(parsed.sortMode)
        ? parsed.sortMode
        : defaults.sortMode,
      filterState: {
        engines: Array.isArray(parsed.filterState?.engines)
          ? parsed.filterState!.engines.filter(
              (engine): engine is string => typeof engine === "string",
            )
          : defaults.filterState.engines,
        styles: Array.isArray(parsed.filterState?.styles)
          ? parsed.filterState!.styles.filter(
              (style): style is string => typeof style === "string",
            )
          : defaults.filterState.styles,
      },
    };
  } catch {
    return defaults;
  }
}

export function Gallery({
  generations,
  onDelete,
  onToggleSidebar,
}: GalleryProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxDownloadUrl, setLightboxDownloadUrl] = useState<string | null>(null);

  const openLightbox = useCallback((viewUrl: string, downloadUrl: string) => {
    setLightboxUrl(viewUrl);
    setLightboxDownloadUrl(downloadUrl);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxUrl(null);
    setLightboxDownloadUrl(null);
  }, []);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>(
    () => loadGalleryPreferences().sortMode,
  );
  const [filterState, setFilterState] = useState<FilterState>(
    () => loadGalleryPreferences().filterState,
  );
  const [gridSize, setGridSize] = useState<GridSize>(
    () => loadGalleryPreferences().gridSize,
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(
    new Set(),
  );
  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleCollapse = (groupIndex: number) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupIndex)) next.delete(groupIndex);
      else next.add(groupIndex);
      return next;
    });
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(
          GALLERY_PREFS_KEY,
          JSON.stringify({ gridSize, sortMode, filterState }),
        );
      } catch {}
    }, 500);
    return () => clearTimeout(id);
  }, [gridSize, sortMode, filterState]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  const hasActiveFilters =
    filterState.engines.length > 0 || filterState.styles.length > 0;

  const toggleEngine = (id: string) => {
    setFilterState((prev) => ({
      ...prev,
      engines: prev.engines.includes(id)
        ? prev.engines.filter((e) => e !== id)
        : [...prev.engines, id],
    }));
  };

  const toggleStyle = (style: string) => {
    setFilterState((prev) => ({
      ...prev,
      styles: prev.styles.includes(style)
        ? prev.styles.filter((s) => s !== style)
        : [...prev.styles, style],
    }));
  };

  const handleDownload = useCallback(async (url: string) => {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ai-studio-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  // --- Filtering + Sorting + Grouping (memoized) ---
  const { groups, isEmpty, totalImages } = useMemo(() => {
    const lowerSearch = debouncedSearch.toLowerCase();
    let filtered = debouncedSearch
      ? generations.filter(
          (g) =>
            g.prompt.toLowerCase().includes(lowerSearch) ||
            g.style.toLowerCase().includes(lowerSearch) ||
            modelName(g.engine).toLowerCase().includes(lowerSearch),
        )
      : generations;

    if (filterState.engines.length > 0) {
      filtered = filtered.filter((g) =>
        filterState.engines.includes(g.engine),
      );
    }
    if (filterState.styles.length > 0) {
      filtered = filtered.filter((g) => filterState.styles.includes(g.style));
    }

    if (sortMode === "oldest") {
      filtered = [...filtered].reverse();
    } else if (sortMode === "prompt-az") {
      filtered = [...filtered].sort((a, b) =>
        a.prompt.localeCompare(b.prompt),
      );
    } else if (sortMode === "prompt-za") {
      filtered = [...filtered].sort((a, b) =>
        b.prompt.localeCompare(a.prompt),
      );
    }

    // Grouping — use Map for O(n) instead of O(n²)
    const groupMap = new Map<string, { prompt: string; generations: Generation[] }>();
    const groupList: { prompt: string; generations: Generation[] }[] = [];
    for (const gen of filtered) {
      const key = `${gen.prompt}__${Math.round(gen._creationTime / 5000)}`;
      const existing = groupMap.get(key);
      if (existing) {
        existing.generations.push(gen);
      } else {
        const group = { prompt: gen.prompt, generations: [gen] };
        groupMap.set(key, group);
        groupList.push(group);
      }
    }

    let imgCount = 0;
    for (const group of groupList) {
      for (const g of group.generations) {
        if (g.status === "complete") imgCount += g.imageUrls.length;
      }
    }

    return { groups: groupList, isEmpty: groupList.length === 0, totalImages: imgCount };
  }, [generations, debouncedSearch, filterState, sortMode]);

  return (
    <main className="flex-1 bg-bg-secondary flex flex-col h-full min-w-0 relative">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 md:px-6 py-3 sm:py-4 shrink-0 border-b border-border/30">
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Mobile sidebar toggle */}
          <button
            onClick={onToggleSidebar}
            className="md:hidden size-8 rounded-lg bg-bg-card flex items-center justify-center hover:bg-bg-card/80 transition-colors"
          >
            <PanelLeftOpen className="size-4 text-text-secondary" />
          </button>
          <div className="size-8 rounded-lg bg-pink/10 flex items-center justify-center">
            <Sparkles className="size-4 text-pink" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-text-primary leading-none">
              Gallery
            </h1>
            {totalImages > 0 && (
              <p className="text-[11px] text-text-muted mt-0.5">
                {totalImages} image{totalImages !== 1 && "s"}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 min-w-0">
          {/* Search */}
          <div className="flex items-center bg-bg-card border border-border/60 rounded-xl px-2 sm:px-3 h-8 sm:h-9 focus-within:border-pink/40 transition-colors min-w-0">
            <Search className="size-3.5 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="bg-transparent border-none outline-none text-xs font-medium text-text-primary placeholder:text-text-muted px-2 py-2 w-14 sm:w-24 focus:w-20 sm:focus:w-36 transition-[width] duration-200"
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X className="size-3 text-text-muted hover:text-text-secondary" />
              </button>
            )}
          </div>

          {/* Grid Size */}
          <div className="flex items-center bg-bg-card border border-border/60 rounded-xl h-8 sm:h-9 p-0.5 sm:p-1 gap-0.5">
            {[
              { size: "small" as GridSize, icon: Grid3x3, title: "Small" },
              { size: "medium" as GridSize, icon: LayoutGrid, title: "Medium" },
              { size: "large" as GridSize, icon: Grid2x2, title: "Large" },
            ].map(({ size, icon: Icon, title }) => (
              <button
                key={size}
                onClick={() => setGridSize(size)}
                className={`size-6 sm:size-7 flex items-center justify-center rounded-lg transition-colors ${
                  gridSize === size
                    ? "bg-pink/15 text-pink"
                    : "text-text-muted hover:text-text-secondary"
                }`}
                title={title}
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen((v) => !v)}
              className={`flex items-center justify-center bg-bg-card border rounded-xl size-8 sm:size-9 hover:border-text-secondary/40 transition-colors ${
                sortMode !== "newest" ? "border-pink/60" : "border-border/60"
              }`}
              title="Sort"
            >
              <ArrowUpDown className="size-3.5 text-text-secondary" />
              {sortMode !== "newest" && (
                <span className="absolute -top-1 -right-1 size-2.5 bg-pink rounded-full ring-2 ring-bg-secondary" />
              )}
            </button>

            {sortOpen && (
              <div className="absolute right-0 top-11 z-40 w-40 sm:w-44 bg-bg-card border border-border/60 rounded-xl shadow-2xl shadow-black/30 p-1.5 flex flex-col">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setSortMode(opt.value);
                      setSortOpen(false);
                    }}
                    className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      sortMode === opt.value
                        ? "bg-pink/10 text-pink"
                        : "text-text-primary hover:bg-bg-secondary"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={`flex items-center justify-center bg-bg-card border rounded-xl size-8 sm:size-9 hover:border-text-secondary/40 transition-colors ${
                hasActiveFilters ? "border-pink/60" : "border-border/60"
              }`}
            >
              <SlidersHorizontal className="size-3.5 text-text-secondary" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 size-2.5 bg-pink rounded-full ring-2 ring-bg-secondary" />
              )}
            </button>

            {filterOpen && (
              <div className="absolute right-0 top-11 z-40 w-52 sm:w-60 bg-bg-card border border-border/60 rounded-xl shadow-2xl shadow-black/30 p-3 flex flex-col gap-3">
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                    Models
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {MODELS.map((m) => (
                      <label
                        key={m.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-secondary cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={filterState.engines.includes(m.id)}
                          onChange={() => toggleEngine(m.id)}
                          className="accent-pink size-3.5"
                        />
                        <span className="text-xs font-medium text-text-primary">
                          {m.name}
                        </span>
                        <BadgeTag badge={m.badge} />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border/40" />

                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                    Art Style
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {ART_STYLES.map((style) => (
                      <label
                        key={style}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-secondary cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={filterState.styles.includes(style)}
                          onChange={() => toggleStyle(style)}
                          className="accent-pink size-3.5"
                        />
                        <span className="text-xs font-medium text-text-primary capitalize">
                          {style}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {hasActiveFilters && (
                  <>
                    <div className="border-t border-border/40" />
                    <button
                      onClick={() =>
                        setFilterState({ engines: [], styles: [] })
                      }
                      className="flex items-center justify-center gap-1.5 text-xs font-bold text-pink hover:text-pink/80 transition-colors py-1"
                    >
                      <X className="size-3" />
                      Clear Filters
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ willChange: "scroll-position" }}>
        <div className="px-5 py-5">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-5 text-text-secondary">
              <div className="size-24 rounded-2xl bg-bg-card/60 border border-border/30 flex items-center justify-center">
                <Sparkles className="size-10 text-border" />
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-text-primary mb-1">
                  No creations yet
                </p>
                <p className="text-xs text-text-muted max-w-[200px]">
                  Write a prompt and hit Generate to see your art here.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {(() => {
                /* Build segments: consecutive singles merge into one grid, comparisons stay separate */
                const segments: (
                  | {
                      type: "comparison";
                      gi: number;
                      group: (typeof groups)[0];
                    }
                  | {
                      type: "singles";
                      items: { gi: number; group: (typeof groups)[0] }[];
                    }
                )[] = [];
                for (let gi = 0; gi < groups.length; gi++) {
                  const group = groups[gi];
                  if (group.generations.length > 1) {
                    segments.push({ type: "comparison", gi, group });
                  } else {
                    const last = segments[segments.length - 1];
                    if (last && last.type === "singles") {
                      last.items.push({ gi, group });
                    } else {
                      segments.push({
                        type: "singles",
                        items: [{ gi, group }],
                      });
                    }
                  }
                }
                return segments.map((seg, si) => {
                  if (seg.type === "comparison") {
                    const { gi, group } = seg;
                    const isCollapsed = collapsedGroups.has(gi);
                    return (
                      <div
                        key={`seg-${si}`}
                        className="rounded-2xl border border-border/30 bg-bg-card/30 overflow-hidden"
                        style={{ contentVisibility: "auto", containIntrinsicSize: "auto 400px" }}
                      >
                        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/20 bg-bg-card/20">
                          <button
                            onClick={() => toggleCollapse(gi)}
                            className="shrink-0 hover:opacity-70 transition-opacity"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="size-3.5 text-text-secondary" />
                            ) : (
                              <ChevronDown className="size-3.5 text-text-secondary" />
                            )}
                          </button>
                          <GitCompareArrows className="size-3.5 text-green shrink-0" />
                          <p className="text-xs text-text-secondary truncate italic flex-1">
                            &ldquo;{group.prompt}&rdquo;
                          </p>
                          <button
                            onClick={() =>
                              handleCopy(group.prompt, `grp-${gi}`)
                            }
                            className="shrink-0 p-1 hover:bg-white/5 rounded-md transition-colors"
                            title="Copy prompt"
                          >
                            {copiedId === `grp-${gi}` ? (
                              <Check className="size-3 text-green" />
                            ) : (
                              <Copy className="size-3 text-text-muted" />
                            )}
                          </button>
                          <span className="text-[10px] font-bold text-green bg-green/10 px-2 py-0.5 rounded-full uppercase shrink-0">
                            Compare
                          </span>
                          <button
                            onClick={() =>
                              group.generations.forEach((g) => onDelete(g._id))
                            }
                            className="shrink-0 p-1 hover:bg-red-500/10 rounded-md transition-colors"
                            title="Delete all in group"
                          >
                            <Trash2 className="size-3 text-text-muted hover:text-red-400" />
                          </button>
                        </div>
                        {!isCollapsed && (
                          <div
                            className="flex flex-col md:grid"
                            style={{
                              gridTemplateColumns: `repeat(${Math.min(group.generations.length, 3)}, 1fr)`,
                            }}
                          >
                            {group.generations.map((gen, colIdx) => (
                              <div
                                key={gen._id}
                                className={`flex flex-col ${colIdx < group.generations.length - 1 ? "border-r border-border/20" : ""}`}
                              >
                                <div className="flex items-center gap-2 px-4 py-2.5 bg-bg-secondary/40 border-b border-border/10">
                                  <span className="text-xs font-bold text-text-primary">
                                    {modelName(gen.engine)}
                                  </span>
                                  <BadgeTag badge={modelBadge(gen.engine)} />
                                  {(gen.status === "pending" ||
                                    gen.status === "generating") && (
                                    <Loader2 className="size-3 text-pink animate-spin ml-auto" />
                                  )}
                                  {gen.status === "failed" && (
                                    <span className="text-[10px] text-red-400 font-bold ml-auto">
                                      FAILED
                                    </span>
                                  )}
                                </div>
                                <div
                                  className={`grid p-3 ${GRID_GAP_CLASSES[gridSize]}`}
                                  style={gridTemplateStyle(gridSize)}
                                >
                                  {gen.status === "complete" &&
                                    gen.imageUrls.map((url, idx) => {
                                      const thumbUrl = gen.thumbnailUrls?.[idx] ?? url;
                                      const dlUrl = gen.originalUrls?.[idx] ?? url;
                                      return (
                                        <ImageCard
                                          key={`${gen._id}-${idx}`}
                                          url={thumbUrl}
                                          onExpand={() => openLightbox(url, dlUrl)}
                                          onDownload={() => handleDownload(dlUrl)}
                                        />
                                      );
                                    })}
                                  {(gen.status === "pending" ||
                                    gen.status === "generating") &&
                                    Array.from(
                                      { length: gen.batchSize || 1 },
                                      (_, i) => (
                                        <div
                                          key={`${gen._id}-skel-${i}`}
                                          className="aspect-square rounded-xl bg-bg-card/60 animate-pulse"
                                        />
                                      ),
                                    )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                  /* ── Consecutive singles in one shared grid ── */
                  return (
                    <div
                      key={`seg-${si}`}
                      className={`grid ${GRID_GAP_CLASSES[gridSize]}`}
                      style={gridTemplateStyle(gridSize)}
                    >
                      {seg.items.flatMap(({ group }) => {
                        const gen = group.generations[0];
                        const isPending =
                          gen.status === "pending" ||
                          gen.status === "generating";
                        const isFailed = gen.status === "failed";
                        if (isFailed) {
                          return [
                            <div
                              key={gen._id}
                              className="group/card rounded-2xl overflow-hidden border border-red-500/20 bg-red-500/5 relative"
                            >
                              <div className="aspect-square flex flex-col items-center justify-center gap-2 text-red-400/60">
                                <X className="size-8" />
                                <span className="text-[10px] font-bold uppercase">
                                  Failed
                                </span>
                              </div>
                              {/* Hover overlay with delete */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 flex items-end justify-between p-2.5">
                                <span className="text-[10px] font-bold text-red-400 truncate">
                                  {gen.error || "Unknown error"}
                                </span>
                                <button
                                  onClick={() => onDelete(gen._id)}
                                  className="size-8 flex items-center justify-center bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors shrink-0"
                                  title="Delete"
                                >
                                  <Trash2 className="size-3.5 text-white" />
                                </button>
                              </div>
                            </div>,
                          ];
                        }
                        if (isPending) {
                          return Array.from(
                            { length: gen.batchSize || 1 },
                            (_, i) => (
                              <div
                                key={`${gen._id}-skeleton-${i}`}
                                className="rounded-2xl overflow-hidden border border-border/30 bg-bg-card/40"
                              >
                                <div className="aspect-square flex items-center justify-center animate-pulse bg-bg-card/60">
                                  <Loader2 className="size-7 text-pink/60 animate-spin" />
                                </div>
                                <div className="px-3 py-2.5 space-y-2">
                                  <div className="h-3 w-3/4 rounded bg-border/20 animate-pulse" />
                                  <div className="h-2.5 w-1/2 rounded bg-border/15 animate-pulse" />
                                </div>
                              </div>
                            ),
                          );
                        }
                        return gen.imageUrls.map((url, idx) => {
                          const thumbUrl = gen.thumbnailUrls?.[idx] ?? url;
                          const dlUrl = gen.originalUrls?.[idx] ?? url;
                          return (
                          <div
                            key={`${gen._id}-${idx}`}
                            className="group/card rounded-2xl overflow-hidden border border-border/30 bg-bg-card/40 hover:border-border/60 transition-[border-color] duration-200"
                            style={{ contentVisibility: "auto", containIntrinsicSize: "auto 300px", contain: "layout style paint" }}
                          >
                            <ImageCard
                              url={thumbUrl}
                              onExpand={() => openLightbox(url, dlUrl)}
                              onDownload={() => handleDownload(dlUrl)}
                            />
                            <div className="px-3 py-2.5 space-y-1.5 border-t border-border/15">
                              <div className="flex items-center gap-1">
                                <p className="text-[11px] text-text-secondary truncate italic leading-tight flex-1">
                                  &ldquo;{gen.prompt}&rdquo;
                                </p>
                                <button
                                  onClick={() =>
                                    handleCopy(gen.prompt, gen._id)
                                  }
                                  className="shrink-0 p-0.5 hover:bg-white/5 rounded transition-colors"
                                  title="Copy prompt"
                                >
                                  {copiedId === gen._id ? (
                                    <Check className="size-3 text-green" />
                                  ) : (
                                    <Copy className="size-3 text-text-muted" />
                                  )}
                                </button>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-text-primary">
                                  {modelName(gen.engine)}
                                </span>
                                <BadgeTag badge={modelBadge(gen.engine)} />
                                {gen.style && gen.style !== "none" && (
                                  <span className="text-[9px] font-medium text-text-muted bg-bg-secondary px-1.5 py-0.5 rounded capitalize leading-none">
                                    {gen.style}
                                  </span>
                                )}
                                <button
                                  onClick={() => onDelete(gen._id)}
                                  className="ml-auto shrink-0 p-0.5 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover/card:opacity-100"
                                  title="Delete"
                                >
                                  <Trash2 className="size-3 text-text-muted hover:text-red-400" />
                                </button>
                              </div>
                            </div>
                          </div>
                          );
                        });
                      })}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-3 sm:p-8"
          onClick={closeLightbox}
        >
          <img
            src={lightboxUrl}
            alt="Generated"
            className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={closeLightbox}
            className="absolute top-3 right-3 sm:top-6 sm:right-6 size-8 sm:size-10 flex items-center justify-center bg-white/10 backdrop-blur rounded-xl text-white hover:bg-white/20 transition-colors"
          >
            <X className="size-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(lightboxDownloadUrl ?? lightboxUrl);
            }}
            className="absolute bottom-3 right-3 sm:bottom-6 sm:right-6 flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shadow-xl"
          >
            <Download className="size-4" />
            Download
          </button>
        </div>
      )}
    </main>
  );
}
