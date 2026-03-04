import { useEffect } from "react";

interface ToastProps {
  message: string;
  onClose: () => void;
}

export function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-3 bg-bg-card border-2 border-pink rounded-full px-6 py-2.5 shadow-2xl">
        <div className="size-3 rounded-full bg-green animate-pulse" />
        <span className="text-sm font-bold text-pink whitespace-nowrap">
          {message}
        </span>
      </div>
    </div>
  );
}
