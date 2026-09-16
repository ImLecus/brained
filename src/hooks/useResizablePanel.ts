import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

export function useResizablePanel(initial: () => number) {
  const [size, setSize] = useState(initial);
  const dragging = useRef(false);

  const clamp = (value: number) => {
    const max = Math.max(520, window.innerWidth - 280);
    return Math.min(max, Math.max(420, value));
  };

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("resizing");
  };

  const onResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) {
      return;
    }
    setSize(clamp(window.innerWidth - event.clientX));
  };

  const endResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) {
      return;
    }
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    document.body.classList.remove("resizing");
  };

  useEffect(() => {
    return () => document.body.classList.remove("resizing");
  }, []);

  return { size, startResize, onResize, endResize };
}