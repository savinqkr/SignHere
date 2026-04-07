"use client";

import { useRef, useState, useCallback } from "react";
import { SignPosition } from "@/types/contract";

interface SignPlaceholderProps {
  containerRef: React.RefObject<HTMLDivElement>;
  currentPage: number;
  onPositionSet: (pos: SignPosition) => void;
  position: SignPosition | null;
}

interface DragState {
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

export default function SignPlaceholder({
  containerRef,
  currentPage,
  onPositionSet,
  position,
}: SignPlaceholderProps) {
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(
    position ? { x: position.x, y: position.y, width: position.width, height: position.height } : null
  );

  const getRelativeCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const bounds = containerRef.current.getBoundingClientRect();
      return {
        x: clientX - bounds.left + containerRef.current.scrollLeft,
        y: clientY - bounds.top + containerRef.current.scrollTop,
      };
    },
    [containerRef]
  );

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const { x, y } = getRelativeCoords(e.clientX, e.clientY);
    dragRef.current = { startX: x, startY: y, offsetX: 0, offsetY: 0 };
    setDragging(true);
    setRect({ x, y, width: 0, height: 0 });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging || !dragRef.current) return;
    const { x, y } = getRelativeCoords(e.clientX, e.clientY);
    const { startX, startY } = dragRef.current;
    setRect({
      x: Math.min(x, startX),
      y: Math.min(y, startY),
      width: Math.abs(x - startX),
      height: Math.abs(y - startY),
    });
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (!dragging || !rect) return;
    setDragging(false);
    dragRef.current = null;
    if (rect.width > 20 && rect.height > 10) {
      const el = containerRef.current;
      const img = el?.querySelector("img");
      const renderWidth = img?.clientWidth ?? el?.clientWidth ?? 1;
      const renderHeight = img?.clientHeight ?? el?.clientHeight ?? 1;
      onPositionSet({ id: crypto.randomUUID(), page: currentPage, ...rect, renderWidth, renderHeight });
    }
  }

  // Touch support
  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    const { x, y } = getRelativeCoords(touch.clientX, touch.clientY);
    dragRef.current = { startX: x, startY: y, offsetX: 0, offsetY: 0 };
    setDragging(true);
    setRect({ x, y, width: 0, height: 0 });
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragging || !dragRef.current) return;
    const touch = e.touches[0];
    const { x, y } = getRelativeCoords(touch.clientX, touch.clientY);
    const { startX, startY } = dragRef.current;
    setRect({
      x: Math.min(x, startX),
      y: Math.min(y, startY),
      width: Math.abs(x - startX),
      height: Math.abs(y - startY),
    });
  }

  function handleTouchEnd() {
    if (!dragging || !rect) return;
    setDragging(false);
    dragRef.current = null;
    if (rect.width > 20 && rect.height > 10) {
      const el = containerRef.current;
      const img = el?.querySelector("img");
      const renderWidth = img?.clientWidth ?? el?.clientWidth ?? 1;
      const renderHeight = img?.clientHeight ?? el?.clientHeight ?? 1;
      onPositionSet({ id: crypto.randomUUID(), page: currentPage, ...rect, renderWidth, renderHeight });
    }
  }

  return (
    <div
      className="absolute inset-0 cursor-crosshair select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {rect && rect.width > 0 && rect.height > 0 && (
        <div
          className="absolute border-2 border-dashed border-blue-500 bg-blue-50/40 rounded pointer-events-none"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
          }}
        >
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-blue-600 font-medium whitespace-nowrap bg-white/80 px-1 rounded">
            서명 위치
          </span>
        </div>
      )}
    </div>
  );
}
