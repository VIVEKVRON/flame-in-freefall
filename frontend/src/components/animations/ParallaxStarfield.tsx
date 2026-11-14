"use client";

import { useEffect, useRef } from "react";

interface StarSpec {
  id: number;
  cx: number;
  cy: number;
  r: number;
  opacity: number;
  accent?: boolean;
}

function createStarLayer(count: number, seed: number, accentRatio: number): StarSpec[] {
  const stars: StarSpec[] = [];
  let state = seed;

  const nextRand = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    stars.push({
      id: i,
      cx: Number((nextRand() * 100).toFixed(2)),
      cy: Number((nextRand() * 100).toFixed(2)),
      r: Number((0.45 + nextRand() * 1.15).toFixed(2)),
      opacity: Number((0.22 + nextRand() * 0.72).toFixed(2)),
      accent: nextRand() < accentRatio,
    });
  }

  return stars;
}

const FAR_STARS = createStarLayer(85, 1304, 0.08);
const MID_STARS = createStarLayer(52, 2026, 0.16);
const NEAR_STARS = createStarLayer(24, 9071, 0.28);

/**
 * Lightweight GPU-composited SVG/CSS parallax starfield.
 * Avoids continuous full-screen canvas redraws so foreground backdrop-blur cards remain 60fps.
 */
export function ParallaxStarfield() {
  const farRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const nearRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let rafId = 0;

    const updateParallax = () => {
      rafId = 0;
      const y = window.scrollY;
      if (farRef.current) {
        farRef.current.style.transform = `translate3d(0, ${-(y * 0.04)}px, 0)`;
      }
      if (midRef.current) {
        midRef.current.style.transform = `translate3d(0, ${-(y * 0.1)}px, 0)`;
      }
      if (nearRef.current) {
        nearRef.current.style.transform = `translate3d(0, ${-(y * 0.18)}px, 0)`;
      }
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(updateParallax);
      }
    };

    updateParallax();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-space-black"
    >
      {/* Subtle deep-space warm thermal atmosphere */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 24% 78%, rgba(255, 107, 0, 0.06) 0%, rgba(160, 48, 0, 0.03) 34%, rgba(0, 0, 0, 1) 75%)",
        }}
      />

      {/* Far Star Plane */}
      <div
        ref={farRef}
        className="star-layer absolute -inset-y-24 inset-x-0 will-change-transform"
      >
        <svg className="h-full w-full" preserveAspectRatio="none">
          {FAR_STARS.map((s) => (
            <circle
              key={s.id}
              cx={`${s.cx}%`}
              cy={`${s.cy}%`}
              r={s.r * 0.7}
              fill={s.accent ? "#FFB020" : "#FFFFFF"}
              fillOpacity={s.opacity * 0.65}
            />
          ))}
        </svg>
      </div>

      {/* Mid Star Plane */}
      <div
        ref={midRef}
        className="star-layer absolute -inset-y-32 inset-x-0 will-change-transform"
      >
        <svg className="h-full w-full" preserveAspectRatio="none">
          {MID_STARS.map((s) => (
            <circle
              key={s.id}
              cx={`${s.cx}%`}
              cy={`${s.cy}%`}
              r={s.r}
              fill={s.accent ? "#FF7A18" : "#FFFFFF"}
              fillOpacity={s.opacity * 0.85}
            />
          ))}
        </svg>
      </div>

      {/* Near Star Plane */}
      <div
        ref={nearRef}
        className="star-layer absolute -inset-y-48 inset-x-0 will-change-transform"
      >
        <svg className="h-full w-full" preserveAspectRatio="none">
          {NEAR_STARS.map((s) => (
            <circle
              key={s.id}
              cx={`${s.cx}%`}
              cy={`${s.cy}%`}
              r={s.r * 1.25}
              fill={s.accent ? "#FF6B00" : "#FFFFFF"}
              fillOpacity={s.opacity}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
