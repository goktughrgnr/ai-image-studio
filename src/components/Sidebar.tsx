import {
  Sparkles,
  ChevronDown,
  Dices,
  Minus,
  Plus,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { GenerationSettings, CanvasShape, ArtStyle } from "../App";
import { MODELS } from "../models";
import { useState, useRef, useEffect } from "react";

interface SidebarProps {
  settings: GenerationSettings;
  onUpdate: <K extends keyof GenerationSettings>(
    key: K,
    value: GenerationSettings[K],
  ) => void;
  onGenerate: () => void;
  onSurprise: () => void;
  isGenerating?: boolean;
  isSurpriseLoading?: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

const CANVAS_SHAPES: { id: CanvasShape; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "classic", label: "Classic" },
  { id: "tall", label: "Tall" },
];

const ART_STYLES: ArtStyle[] = [
  "none",
  "comic",
  "3d toon",
  "sketch",
  "pop art",
];

function badgeColor(badge: string) {
  switch (badge) {
    case "PRO":
      return "bg-gold/20 text-gold";
    case "FAST":
      return "bg-green/20 text-green";
    case "FREE":
      return "bg-pink/20 text-pink";
    default:
      return "bg-white/10 text-text-secondary";
  }
}

export function Sidebar({
  settings,
  onUpdate,
  onGenerate,
  onSurprise,
  isGenerating,
  isSurpriseLoading,
  isOpen,
  onToggle,
}: SidebarProps) {
  const [engineOpen, setEngineOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedModels = MODELS.filter((m) => settings.engines.includes(m.id));

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setEngineOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleEngine = (id: string) => {
    const current = settings.engines;
    if (current.includes(id)) {
      onUpdate(
        "engines",
        current.filter((e) => e !== id),
      );
    } else {
      onUpdate("engines", [...current, id]);
    }
  };

  const handleSurprise = () => {
    if (isSurpriseLoading) return;
    onSurprise();
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }, [settings.prompt]);

  const summaryText =
    selectedModels.length === 0
      ? "Select a model"
      : selectedModels.length === 1
        ? selectedModels[0].name
        : `${selectedModels.length} models selected`;

  const summaryDesc =
    selectedModels.length === 0
      ? "Choose an image model to get started"
      : selectedModels.length === 1
        ? selectedModels[0].description
        : selectedModels.map((m) => m.name).join(", ");

  if (!isOpen) {
    return (
      <aside className="hidden md:flex w-12 bg-bg-primary border-r border-border flex-col items-center py-3 gap-3 h-full shrink-0">
        <button
          onClick={onToggle}
          className="size-8 flex items-center justify-center rounded-lg hover:bg-bg-card transition-colors group"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="size-4 text-text-muted group-hover:text-pink transition-colors" />
        </button>
        <div className="w-6 border-t border-border/40" />
        <button
          onClick={onGenerate}
          disabled={
            !settings.prompt.trim() ||
            isGenerating ||
            settings.engines.length === 0
          }
          className="size-8 flex items-center justify-center rounded-lg bg-pink/10 hover:bg-pink/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Generate"
        >
          <Sparkles className="size-4 text-pink" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-72 md:w-80 bg-bg-primary border-r border-border flex flex-col h-full shrink-0">
      <div className="flex items-center justify-between px-3 pt-2 pb-0">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
          Settings
        </span>
        <button
          onClick={onToggle}
          className="size-7 flex items-center justify-center rounded-lg hover:bg-bg-card transition-colors group"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="size-3.5 text-text-muted group-hover:text-pink transition-colors" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden p-3 pt-2 flex flex-col gap-2">
        {/* Engine Selector */}
        <div className="relative flex flex-col gap-1.5" ref={dropdownRef}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-pink uppercase tracking-widest">
              Image Model
            </label>
            {selectedModels.length > 1 && (
              <span className="text-[10px] font-bold text-green uppercase tracking-wider">
                Compare Mode
              </span>
            )}
          </div>
          <button
            onClick={() => setEngineOpen(!engineOpen)}
            className={`flex items-center justify-between px-3 py-2 bg-bg-card border-2 rounded-xl w-full text-left transition-colors ${
              engineOpen ? "border-pink" : "border-border"
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-text-primary truncate">
                  {summaryText}
                </span>
                {selectedModels.length === 1 && selectedModels[0].badge && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase ${badgeColor(selectedModels[0].badge)}`}
                  >
                    {selectedModels[0].badge}
                  </span>
                )}
              </div>
              <div className="text-xs text-text-secondary truncate">
                {summaryDesc}
              </div>
            </div>
            <ChevronDown
              className={`size-5 text-text-secondary shrink-0 transition-transform ${
                engineOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Dropdown — multi-select */}
          {engineOpen && (
            <div className="absolute top-full left-0 right-0 bg-bg-card border-2 border-border rounded-xl overflow-hidden shadow-xl -mt-1 z-20">
              <div className="px-3 py-1.5 border-b border-border/50">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                  Select multiple to compare
                </span>
              </div>
              {MODELS.map((model) => {
                const isActive = settings.engines.includes(model.id);
                return (
                  <button
                    key={model.id}
                    onClick={() => toggleEngine(model.id)}
                    className={`flex items-center justify-between w-full px-3 py-2 text-left transition-colors ${
                      isActive ? "bg-pink/10" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-bold truncate ${
                            isActive ? "text-pink" : "text-text-primary"
                          }`}
                        >
                          {model.name}
                        </span>
                        {model.badge && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase ${badgeColor(model.badge)}`}
                          >
                            {model.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary">
                          {model.description}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {model.price}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`size-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isActive ? "bg-pink border-pink" : "border-border"
                      }`}
                    >
                      {isActive && <Check className="size-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Prompt */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-pink uppercase tracking-widest">
              Your Dream
            </label>
            <button
              onClick={handleSurprise}
              className="flex items-center gap-1 text-green text-xs font-bold hover:opacity-80 transition-opacity"
            >
              <Dices
                className={`size-2.5 ${isSurpriseLoading ? "animate-spin" : ""}`}
              />
              {isSurpriseLoading ? "Thinking..." : "Surprise Me!"}
            </button>
          </div>
          <div className="bg-bg-card border-2 border-border rounded-xl focus-within:border-pink transition-colors overflow-hidden">
            <textarea
              ref={textareaRef}
              value={settings.prompt}
              onChange={(e) => onUpdate("prompt", e.target.value)}
              placeholder="Describe your dream cartoon..."
              className="px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none w-full bg-transparent block min-h-[80px] max-h-[160px] overflow-y-auto"
            />
          </div>
        </div>

        {/* Negative Prompt */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-pink uppercase tracking-widest">
            No Grumpy Stuff
          </label>
          <input
            value={settings.negativePrompt}
            onChange={(e) => onUpdate("negativePrompt", e.target.value)}
            placeholder="Scary, dark, messy..."
            className="bg-bg-card border-2 border-border rounded-xl px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted h-8 focus:outline-none focus:border-pink transition-colors w-full"
          />
        </div>

        {/* Canvas Shape */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-pink uppercase tracking-widest">
            Canvas Shape
          </label>
          <div className="flex gap-2">
            {CANVAS_SHAPES.map((shape) => {
              const isActive = settings.canvasShape === shape.id;
              return (
                <button
                  key={shape.id}
                  onClick={() => onUpdate("canvasShape", shape.id)}
                  className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl border-2 flex-1 transition-all relative ${
                    isActive
                      ? "bg-green/10 border-green"
                      : "bg-bg-card border-border hover:border-text-secondary"
                  }`}
                >
                  <div
                    className={`border-2 rounded-sm ${
                      isActive ? "border-green" : "border-slate"
                    } ${
                      shape.id === "square"
                        ? "size-5"
                        : shape.id === "classic"
                          ? "w-7 h-5"
                          : "w-3.5 h-7"
                    }`}
                  />
                  <span
                    className={`text-[10px] font-bold ${
                      isActive ? "text-green" : "text-text-secondary"
                    }`}
                  >
                    {shape.label}
                  </span>
                  {isActive && (
                    <div className="absolute top-1 right-1 size-1.5 rounded-full bg-gold" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Art Style */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-pink uppercase tracking-widest">
            Art Style
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {ART_STYLES.map((style) => {
              const isActive = settings.artStyle === style;
              return (
                <button
                  key={style}
                  onClick={() => onUpdate("artStyle", style)}
                  className={`py-1.5 rounded-lg border-2 text-[11px] font-bold text-center transition-all capitalize ${
                    isActive
                      ? "bg-pink border-pink text-white shadow-[2px_2px_0px_0px_black]"
                      : "bg-bg-card border-border text-text-primary hover:border-text-secondary"
                  }`}
                >
                  {style === "none" ? "No Style" : style}
                </button>
              );
            })}
          </div>
        </div>

        {/* Batch Size */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-pink uppercase tracking-widest">
            Batch Size
          </label>
          <div className="flex items-center justify-between bg-bg-card border-2 border-border rounded-lg p-1">
            <button
              onClick={() =>
                onUpdate("batchSize", Math.max(1, settings.batchSize - 1))
              }
              className="size-7 flex items-center justify-center rounded-md hover:bg-border/30 transition-colors"
            >
              <Minus className="size-3.5 text-pink" />
            </button>
            <span className="text-sm font-bold text-text-primary">
              {settings.batchSize}
            </span>
            <button
              onClick={() =>
                onUpdate("batchSize", Math.min(10, settings.batchSize + 1))
              }
              className="size-7 flex items-center justify-center rounded-md hover:bg-border/30 transition-colors"
            >
              <Plus className="size-3.5 text-green" />
            </button>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="border-t-2 border-border bg-bg-primary px-3 py-3">
        <button
          onClick={onGenerate}
          disabled={
            !settings.prompt.trim() ||
            isGenerating ||
            settings.engines.length === 0
          }
          className="w-full bg-pink rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-bold text-white shadow-[0px_3px_0px_0px_#b03463] hover:brightness-110 active:shadow-[0px_1px_0px_0px_#b03463] active:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="size-4" />
          {isGenerating
            ? "Generating..."
            : settings.engines.length > 1
              ? `Compare ${settings.engines.length} Models`
              : "Dream Up!"}
        </button>
      </div>
    </aside>
  );
}
