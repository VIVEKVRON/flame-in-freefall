"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

interface FlameParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  hueMix: number;
}

interface MicrogravityFireProps {
  /** Scrubbed ignition intensity (0 = unlit, 1 = full orange ignition plume). */
  ignitionRef: MutableRefObject<number>;
  className?: string;
}

const PARTICLE_COUNT = 135;

function resetParticle(p: FlameParticle, cx: number, cy: number, initial = false) {
  // Emit from twin SRB + central SSME nozzle band
  const nozzleSpread = (Math.random() - 0.5) * 44;
  p.x = cx + nozzleSpread;
  p.y = cy + Math.random() * 8;
  // Plume travels downward in shuttle-local coordinates (which trails diagonally at 45 deg pitch)
  p.vx = (Math.random() - 0.5) * 0.85 + nozzleSpread * 0.015;
  p.vy = 1.4 + Math.random() * 2.3;
  p.size = 2 + Math.random() * 4.5;
  p.alpha = 0.45 + Math.random() * 0.55;
  p.maxLife = 42 + Math.random() * 52;
  p.life = initial ? Math.random() * p.maxLife : 0;
  p.hueMix = Math.random();
}

/**
 * Renders luminous orange shuttle ignition flames and ember plume on HTML5 Canvas.
 * Positioned below the shuttle nozzles so it rotates seamlessly with the 45° diagonal trajectory.
 */
export function MicrogravityFire({
  ignitionRef,
  className = "",
}: MicrogravityFireProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const particles: FlameParticle[] = Array.from(
      { length: PARTICLE_COUNT },
      () => ({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 0,
        alpha: 0,
        life: 0,
        maxLife: 60,
        hueMix: 0,
      })
    );

    let initialized = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cx = rect.width * 0.5;
      const originY = rect.height * 0.16;
      if (!initialized) {
        for (let i = 0; i < particles.length; i++) {
          resetParticle(particles[i], cx, originY, true);
        }
        initialized = true;
      }
    };

    resize();
    window.addEventListener("resize", resize);

    let rafId = 0;
    let tick = 0;
    let isVisible = true;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry?.isIntersecting ?? true;
      },
      { threshold: 0.02 }
    );
    observer.observe(canvas);

    const renderFrame = () => {
      rafId = window.requestAnimationFrame(renderFrame);
      if (!isVisible) return;

      const intensity = Math.max(0, Math.min(1, ignitionRef.current));
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      ctx.clearRect(0, 0, width, height);
      if (intensity <= 0.01) return;

      tick += 0.06;
      const cx = width * 0.5;
      const originY = height * 0.16;
      const pulse = 1 + Math.sin(tick * 2.2) * 0.06;
      const plumeRadius = Math.min(width, height) * 0.34 * (0.35 + intensity * 0.72) * pulse;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // Hot orange-amber ignition core at engine bells
      const coreGrad = ctx.createRadialGradient(
        cx,
        originY + 8,
        plumeRadius * 0.04,
        cx,
        originY + 34 * intensity,
        plumeRadius * 1.25
      );
      coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.9 * intensity})`);
      coreGrad.addColorStop(0.22, `rgba(255, 196, 56, ${0.85 * intensity})`);
      coreGrad.addColorStop(0.5, `rgba(255, 107, 0, ${0.58 * intensity})`);
      coreGrad.addColorStop(0.8, `rgba(255, 45, 0, ${0.22 * intensity})`);
      coreGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, originY + 26 * intensity, plumeRadius * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // Secondary fiery orange plume particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life += 1;
        p.x += p.vx * (0.7 + intensity * 0.6);
        p.y += p.vy * (0.6 + intensity * 0.95);

        if (p.life >= p.maxLife || p.y > height * 0.96) {
          resetParticle(p, cx, originY, false);
        }

        const lifeProgress = p.life / p.maxLife;
        const fade = Math.sin(lifeProgress * Math.PI) * (1 - lifeProgress * 0.35);
        const particleAlpha = p.alpha * fade * intensity;

        ctx.fillStyle =
          p.hueMix > 0.82
            ? `rgba(255, 240, 190, ${particleAlpha})`
            : p.hueMix > 0.38
            ? `rgba(255, 145, 24, ${particleAlpha})`
            : `rgba(255, 68, 0, ${particleAlpha * 0.92})`;

        ctx.beginPath();
        ctx.arc(
          p.x,
          p.y,
          p.size * (1 - lifeProgress * 0.45) * (0.65 + intensity * 0.55),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      ctx.restore();
    };

    rafId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, [ignitionRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Orange shuttle ignition flame plume"
      className={`pointer-events-none block ${className}`}
    />
  );
}
