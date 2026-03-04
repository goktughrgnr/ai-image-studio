import { useState, useCallback, useEffect, useRef } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { Gallery } from "./components/Gallery";
import { Toast } from "./components/Toast";
import { MODELS } from "./models";

export type CanvasShape = "square" | "classic" | "tall";
export type ArtStyle = "none" | "comic" | "3d toon" | "sketch" | "pop art";

export interface GenerationSettings {
  engines: string[];
  prompt: string;
  negativePrompt: string;
  canvasShape: CanvasShape;
  artStyle: ArtStyle;
  batchSize: number;
}

const STORAGE_KEY = "ai-studio-settings";
const MAX_BATCH_SIZE = 10;

const DEFAULT_SETTINGS: GenerationSettings = {
  engines: [],
  prompt: "",
  negativePrompt: "",
  canvasShape: "classic",
  artStyle: "comic",
  batchSize: 4,
};

function loadSettings(): GenerationSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        batchSize: Math.min(
          MAX_BATCH_SIZE,
          Math.max(1, Number(parsed?.batchSize ?? DEFAULT_SETTINGS.batchSize)),
        ),
      };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: GenerationSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export default function App() {
  const [settings, setSettings] = useState<GenerationSettings>(loadSettings);
  const [toast, setToast] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSurpriseLoading, setIsSurpriseLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Debounced settings save — avoids localStorage write on every keystroke
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveSettings(settings), 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [settings]);

  const generations = useQuery(api.generations.list, {}) ?? [];
  const createGeneration = useMutation(api.generations.create);
  const removeGeneration = useMutation(api.generations.remove);
  const generateImages = useAction(api.generate.generate);
  const generateSurprisePrompt = useAction(api.surprise.generatePrompt);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await removeGeneration({ id: id as Id<"generations"> });
      } catch {
        setToast("Failed to delete generation");
      }
    },
    [removeGeneration],
  );

  const handleGenerate = async () => {
    if (
      !settings.prompt.trim() ||
      isGenerating ||
      settings.engines.length === 0
    )
      return;
    setIsGenerating(true);

    const totalImages = settings.engines.length * settings.batchSize;
    const modelNames = settings.engines
      .map((e) => MODELS.find((m) => m.id === e)?.name ?? e)
      .join(", ");

    setToast(
      settings.engines.length > 1
        ? `Comparing ${modelNames}... (${totalImages} images)`
        : `Dreaming up ${settings.batchSize} image${settings.batchSize > 1 ? "s" : ""}...`,
    );

    try {
      const promises = settings.engines.map(async (engine) => {
        const id = await createGeneration({
          prompt: settings.prompt,
          negativePrompt: settings.negativePrompt || undefined,
          style: settings.artStyle,
          canvasShape: settings.canvasShape,
          engine,
          batchSize: settings.batchSize,
        });

        return generateImages({
          generationId: id,
          prompt: settings.prompt,
          negativePrompt: settings.negativePrompt || undefined,
          style: settings.artStyle,
          canvasShape: settings.canvasShape,
          engine,
          batchSize: settings.batchSize,
        });
      });

      const results = await Promise.allSettled(promises);
      const succeeded = results.filter(
        (r) => r.status === "fulfilled",
      ).length;
      const failures = results.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      if (failures.length > 0) {
        const firstError = failures[0].reason?.message || "Unknown error";
        setToast(
          succeeded > 0
            ? `${succeeded} succeeded, ${failures.length} failed: ${firstError}`
            : `Generation failed: ${firstError}`,
        );
      } else {
        setToast(`Yay! ${totalImages} new images ready!`);
      }
    } catch {
      setToast("Failed to start generation");
    } finally {
      setIsGenerating(false);
    }
  };

  const update = useCallback(
    <K extends keyof GenerationSettings>(
      key: K,
      value: GenerationSettings[K],
    ) => {
      setSettings((s) => ({
        ...s,
        [key]:
          key === "batchSize"
            ? Math.min(MAX_BATCH_SIZE, Math.max(1, Number(value)))
            : value,
      }));
    },
    [],
  );

  const handleSurprise = async () => {
    setIsSurpriseLoading(true);
    try {
      const prompt = await generateSurprisePrompt();
      setSettings((s) => ({ ...s, prompt }));
    } catch {
      setToast("Failed to generate surprise prompt");
    } finally {
      setIsSurpriseLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg-primary font-sans">
      <Header />
      <div className="flex flex-1 min-h-0">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar: overlay on mobile, normal flow on desktop */}
        <div
          className={`${
            sidebarOpen
              ? "fixed inset-y-0 left-0 z-40 md:relative md:inset-auto"
              : "hidden md:block"
          }`}
        >
          <Sidebar
            settings={settings}
            onUpdate={update}
            onGenerate={handleGenerate}
            onSurprise={handleSurprise}
            isGenerating={isGenerating}
            isSurpriseLoading={isSurpriseLoading}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen((v) => !v)}
          />
        </div>
        <Gallery
          generations={generations}
          onDelete={handleDelete}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
