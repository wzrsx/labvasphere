// src/utils/ConnectionLine.js
import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const ConnectionLine = ({ fromRef, toRef, fromIndex }) => {
  const svgRef = useRef(null);
  const pathRef = useRef(null);
  const rafRef = useRef();

  const updatePath = () => {
    if (!fromRef?.current || !toRef?.current || !pathRef.current) return;

    const fromRect = fromRef.current.getBoundingClientRect();
    const toRect = toRef.current.getBoundingClientRect();

    const fromIsLeft = fromIndex % 2 === 0;
    const x1 = fromIsLeft ? fromRect.right : fromRect.left;
    const y1 = fromRect.top + fromRect.height / 2;
    const x2 = toRect.left + toRect.width / 2;
    const y2 = toRect.top;

    const dx = x2 - x1;
    const dy = y2 - y1;

    // Сила изгиба — адаптивная
    const bendStrength = -Math.max(15, Math.abs(dx) * 0.05);

    const cp1x = x1 + dx / 4;
    const cp1y = y1 + bendStrength;

    const cp2x = x1 + (2 * dx) / 3.5;
    const cp2y = y1 + bendStrength;

    const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
    pathRef.current.setAttribute("d", d);
  };

  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);

    const onScrollOrResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updatePath);
    };

    updatePath();

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [fromRef, toRef, fromIndex]);

  if (!mounted) return null;

  return createPortal(
    <svg
      ref={svgRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      {/* Определяем фильтр свечения */}
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        ref={pathRef}
        fill="none"
        stroke="#000000"
        strokeWidth="2.5"
        strokeDasharray="8,15"
        filter="url(#glow)"
      />
    </svg>,
    document.body
  );
};

export default ConnectionLine;
