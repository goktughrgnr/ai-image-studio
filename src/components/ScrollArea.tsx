import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

function ScrollArea({
  className,
  children,
  ...props
}: ScrollAreaPrimitive.Root.Props) {
  return (
    <ScrollAreaPrimitive.Root
      className={`relative ${className ?? ""}`}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport className="size-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar orientation="vertical" />
      <ScrollBar orientation="horizontal" />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      orientation={orientation}
      className={`flex touch-none p-px transition-opacity select-none data-[hovering]:opacity-100 opacity-0 ${
        orientation === "horizontal"
          ? "h-2.5 flex-col border-t border-t-transparent"
          : "h-full w-2.5 border-l border-l-transparent"
      } ${className ?? ""}`}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb className="rounded-full relative flex-1 bg-white/15 hover:bg-white/25 transition-colors" />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };
