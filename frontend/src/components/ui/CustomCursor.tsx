"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export function CustomCursor() {
  const reticleRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Disable custom cursor on touch/mobile devices or when fine pointer is absent
    const isTouchDevice =
      window.matchMedia("(pointer: coarse)").matches ||
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0;

    if (isTouchDevice) {
      if (containerRef.current) {
        containerRef.current.style.display = "none";
      }
      return;
    }

    const reticle = reticleRef.current;
    const orbit = orbitRef.current;
    const container = containerRef.current;

    if (!reticle || !orbit || !container) return;

    // Set initial position offscreen and hidden until first move
    gsap.set([reticle, orbit], {
      xPercent: -50,
      yPercent: -50,
      opacity: 0,
      pointerEvents: "none",
    });

    // High-performance quickTo setters (executes on compositor thread without React re-renders)
    const quickReticleX = gsap.quickTo(reticle, "x", {
      duration: 0.04,
      ease: "none",
    });
    const quickReticleY = gsap.quickTo(reticle, "y", {
      duration: 0.04,
      ease: "none",
    });

    const quickOrbitX = gsap.quickTo(orbit, "x", {
      duration: 0.22,
      ease: "power2.out",
    });
    const quickOrbitY = gsap.quickTo(orbit, "y", {
      duration: 0.22,
      ease: "power2.out",
    });

    let hasAppeared = false;

    // Continuous slow zero-g rotation for outer orbit ring
    const orbitSpin = gsap.to(orbit, {
      rotation: 360,
      duration: 24,
      repeat: -1,
      ease: "none",
    });

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;

      if (!hasAppeared) {
        hasAppeared = true;
        gsap.to([reticle, orbit], {
          opacity: 1,
          duration: 0.25,
          ease: "power1.out",
        });
      }

      quickReticleX(clientX);
      quickReticleY(clientY);
      quickOrbitX(clientX);
      quickOrbitY(clientY);
    };

    const handleMouseDown = () => {
      gsap.to(orbit, {
        scale: 0.78,
        duration: 0.12,
        ease: "power2.out",
      });
      gsap.to(reticle, {
        scale: 1.4,
        backgroundColor: "#ffffff",
        duration: 0.12,
        ease: "power2.out",
      });
    };

    const handleMouseUp = () => {
      gsap.to(orbit, {
        scale: 1,
        duration: 0.2,
        ease: "power2.out",
      });
      gsap.to(reticle, {
        scale: 1,
        backgroundColor: "#ff6b00",
        duration: 0.2,
        ease: "power2.out",
      });
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const interactive = target.closest(
        'button, a, input, textarea, select, [role="button"], [role="radio"], .glass-panel-interactive, [data-cursor="interactive"], [data-cursor-interactive]'
      );

      if (interactive) {
        gsap.to(orbit, {
          scale: 1.65,
          duration: 0.22,
          ease: "back.out(1.8)",
          borderColor: "rgba(255, 176, 32, 0.9)",
          backgroundColor: "rgba(255, 107, 0, 0.12)",
          boxShadow: "0 0 20px rgba(255, 107, 0, 0.45)",
        });
        gsap.to(reticle, {
          scale: 0.6,
          backgroundColor: "#ffb020",
          duration: 0.2,
        });
        orbitSpin.timeScale(2.5);
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const interactive = target.closest(
        'button, a, input, textarea, select, [role="button"], [role="radio"], .glass-panel-interactive, [data-cursor="interactive"], [data-cursor-interactive]'
      );

      if (interactive) {
        gsap.to(orbit, {
          scale: 1,
          duration: 0.24,
          ease: "power2.out",
          borderColor: "rgba(255, 107, 0, 0.5)",
          backgroundColor: "rgba(255, 107, 0, 0.02)",
          boxShadow: "0 0 10px rgba(255, 107, 0, 0.25)",
        });
        gsap.to(reticle, {
          scale: 1,
          backgroundColor: "#ff6b00",
          duration: 0.2,
        });
        orbitSpin.timeScale(1);
      }
    };

    const handleMouseLeave = () => {
      gsap.to([reticle, orbit], {
        opacity: 0,
        duration: 0.2,
        ease: "power1.out",
      });
      hasAppeared = false;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseover", handleMouseOver, { passive: true });
    document.addEventListener("mouseout", handleMouseOut, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      orbitSpin.kill();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden select-none"
    >
      {/* Outer Zero-G Orbit HUD Ring */}
      <div
        ref={orbitRef}
        className="fixed top-0 left-0 h-10 w-10 rounded-full border border-flame-orange/50 bg-flame-orange/[0.02] shadow-[0_0_10px_rgba(255,107,0,0.25)] backdrop-blur-[1px]"
      >
        {/* Aerospace HUD Crosshair Reticle Notches */}
        <svg
          viewBox="0 0 40 40"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          {/* Top Notch */}
          <line
            x1="20"
            y1="0"
            x2="20"
            y2="4"
            stroke="#ff6b00"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Bottom Notch */}
          <line
            x1="20"
            y1="36"
            x2="20"
            y2="40"
            stroke="#ff6b00"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Left Notch */}
          <line
            x1="0"
            y1="20"
            x2="4"
            y2="20"
            stroke="#ff6b00"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Right Notch */}
          <line
            x1="36"
            y1="20"
            x2="40"
            y2="20"
            stroke="#ff6b00"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Orbit Ticks */}
          <circle
            cx="20"
            cy="20"
            r="17"
            fill="none"
            stroke="rgba(255, 176, 32, 0.35)"
            strokeWidth="1"
            strokeDasharray="3 7"
          />
        </svg>
      </div>

      {/* Central Precision Telemetry Reticle Dot */}
      <div
        ref={reticleRef}
        className="fixed top-0 left-0 h-1.5 w-1.5 rounded-full bg-flame-orange shadow-[0_0_8px_#ff6b00,0_0_16px_rgba(255,107,0,0.8)]"
      />
    </div>
  );
}
