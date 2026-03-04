import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Download } from "lucide-react";

interface ImageCardProps {
  url: string;
  onExpand: () => void;
  onDownload: () => void;
}

export const ImageCard = memo(function ImageCard({
  url,
  onExpand,
  onDownload,
}: ImageCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleLoad = useCallback(() => setLoaded(true), []);

  return (
    <div
      ref={containerRef}
      className="relative bg-bg-card rounded-2xl overflow-hidden shadow-lg group cursor-pointer"
      onClick={onExpand}
    >
      <div className="aspect-square">
        {(!inView || !loaded) && (
          <div className="absolute inset-0 bg-bg-card/60 animate-pulse" />
        )}
        {inView && (
          <img
            src={url}
            alt="Generated artwork"
            className={`w-full h-full object-cover group-hover:scale-105 transition-[transform,opacity] duration-500 ease-out ${
              loaded ? "opacity-100 scale-100" : "opacity-0 scale-[1.02]"
            }`}
            decoding="async"
            onLoad={handleLoad}
          />
        )}
      </div>

      {/* Hover overlay — download only */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-end p-2.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          className="size-8 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-white transition-colors"
        >
          <Download className="size-3.5 text-gray-700" />
        </button>
      </div>
    </div>
  );
});
