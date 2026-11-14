"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowDown, Flame, Orbit, ShieldAlert } from "lucide-react";
import { MicrogravityFire } from "./MicrogravityFire";

interface StoryChapter {
  id: string;
  tag: string;
  title: string;
  metric: string;
  body: string;
  placement: "top-right" | "bottom-left";
  icon: "alert" | "orbit" | "flame";
}

const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: "apollo-13",
    tag: "MISSION LOG // 1970 · APOLLO 13",
    title: "Supercritical Oxygen & Wire Arc Ignition",
    metric: "100% O₂ · CRYO TANK 2",
    body: "Damaged PTFE insulation inside Oxygen Tank 2 arced in pure oxygen, proving that without nitrogen diluent, small electrical faults rapidly escalate into catastrophic cabin overpressure.",
    placement: "top-right",
    icon: "alert",
  },
  {
    id: "ignition-physics",
    tag: "IGNITION // 45° ASCENT TRANSITION",
    title: "From Booster Thrust to Freefall Combustion",
    metric: "0.000 g · DIFFUSION REGIME",
    body: "During orbital insertion, gravity-driven buoyancy drops to zero. Without hot exhaust rising to pull fresh oxygen inward, spacecraft fires behave unpredictably in quiescent cabin air.",
    placement: "top-right",
    icon: "flame",
  },
  {
    id: "artemis-ii",
    tag: "NEXT-GEN // ARTEMIS II & SAFFIRE",
    title: "Exploration Atmospheres Demand New Thresholds",
    metric: "10.2 PSI · 30% O₂ ENVELOPE",
    body: "Artemis habitats lower total pressure and raise oxygen to 30% to cut EVA pre-breathe time. Full-scale Saffire tests aboard Cygnus revealed that low-velocity airflow sustains rapid flame spread.",
    placement: "bottom-left",
    icon: "orbit",
  },
];

function ChapterIcon({ icon }: { icon: StoryChapter["icon"] }) {
  if (icon === "alert") return <ShieldAlert className="h-4 w-4 text-flame-amber" />;
  if (icon === "flame") return <Flame className="h-4 w-4 text-flame-orange" />;
  return <Orbit className="h-4 w-4 text-flame-orange" />;
}

function subscribeReducedMotion(callback: () => void) {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const REDUCED_MOTION_TELEMETRY = {
  scrollPct: 50,
  gravityLabel: "0.00 g",
  regimeLabel: "ORANGE IGNITION ACTIVE",
};

/**
 * Scroll-bound Space Shuttle narrative built with GSAP + ScrollTrigger (scrub: true).
 * Starts at the bottom-left corner pitched 45° clockwise, ignites orange flames at ~40–55%,
 * glides diagonally to the top-right corner, and triggers a centered orange sphere wipe into the Dashboard.
 */
export function RocketScrollStory() {
  const triggerRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const rocketWrapRef = useRef<HTMLDivElement>(null);
  const wipeSphereRef = useRef<HTMLDivElement>(null);
  const heroHeaderRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ignitionRef = useRef<number>(0);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );

  const [scrollTelemetry, setScrollTelemetry] = useState({
    scrollPct: 0,
    gravityLabel: "1.00 g",
    regimeLabel: "PAD STAGED // BOTTOM-LEFT",
  });

  const telemetry = reducedMotion ? REDUCED_MOTION_TELEMETRY : scrollTelemetry;

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const triggerEl = triggerRef.current;
    const pinEl = pinRef.current;
    const rocketEl = rocketWrapRef.current;
    const wipeEl = wipeSphereRef.current;
    if (!triggerEl || !pinEl || !rocketEl || !wipeEl) return;

    if (reducedMotion) {
      ignitionRef.current = 0.85;
      gsap.set(rocketEl, { x: 0, y: 0, rotation: 45, scale: 1 });
      return;
    }

    let lastBucket = -1;

    const ctx = gsap.context(() => {
      // Initial states for chapter cards
      chapterRefs.current.forEach((card) => {
        if (!card) return;
        gsap.set(card, { autoAlpha: 0, y: 50 });
      });

      // Stage shuttle at bottom-left corner, pitched 45° clockwise toward top-right
      gsap.set(rocketEl, {
        x: "-30vw",
        y: "24vh",
        rotation: 45,
        scale: 0.9,
      });

      gsap.set(wipeEl, { scale: 0.12, opacity: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: triggerEl,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          pin: pinEl,
          anticipatePin: 1,
          onUpdate: (self) => {
            const p = self.progress;
            // Ignite orange flames around 35%–52% and sustain through diagonal climb
            const ignition =
              p < 0.34
                ? 0
                : p < 0.52
                ? (p - 0.34) / 0.18
                : p < 0.9
                ? 1
                : Math.max(0, 1 - (p - 0.9) / 0.08);
            ignitionRef.current = ignition;

            const pctBucket = Math.round(p * 100);
            if (pctBucket !== lastBucket) {
              lastBucket = pctBucket;
              const gVal = Math.max(0, 1 - p * 1.8).toFixed(2);
              const regime =
                p < 0.34
                  ? "STAGED // LEFT CORNER"
                  : p < 0.55
                  ? "IGNITION // FULL THRUST"
                  : p < 0.85
                  ? "ASCENT // 45° DIAGONAL CLIMB"
                  : "CENTER WIPE // TERMINAL HANDOFF";
              setScrollTelemetry({
                scrollPct: pctBucket,
                gravityLabel: `${gVal} g`,
                regimeLabel: regime,
              });
            }
          },
        },
      });

      // 0% -> 18%: Fade initial hero header upward as shuttle settles into ignition readiness
      if (heroHeaderRef.current) {
        tl.to(
          heroHeaderRef.current,
          { autoAlpha: 0, y: -32, duration: 0.16, ease: "none" },
          0.02
        );
      }

      // 0% -> 36%: Subtle pre-ignition vibration/lift in the bottom-left corner
      tl.to(
        rocketEl,
        {
          x: "-26vw",
          y: "20vh",
          rotation: 45,
          scale: 0.96,
          duration: 0.34,
          ease: "power1.out",
        },
        0
      );

      // 36% -> 54%: Ignition hold & thrust build at bottom-left
      tl.to(
        rocketEl,
        {
          x: "-20vw",
          y: "14vh",
          rotation: 45,
          scale: 1.02,
          duration: 0.18,
          ease: "power1.inOut",
        },
        0.34
      );

      // 52% -> 86%: Diagonal climb across viewport to top-right corner
      tl.to(
        rocketEl,
        {
          x: "34vw",
          y: "-30vh",
          rotation: 45,
          scale: 0.92,
          duration: 0.34,
          ease: "power1.in",
        },
        0.52
      );

      // Narrative cards placed in open opposite quadrants
      const slots = [0.1, 0.36, 0.6];
      chapterRefs.current.forEach((card, idx) => {
        if (!card) return;
        const start = slots[idx] ?? 0.15 + idx * 0.24;
        tl.to(card, { autoAlpha: 1, y: 0, duration: 0.09, ease: "power2.out" }, start)
          .to(card, { autoAlpha: 0, y: -48, duration: 0.09, ease: "power2.in" }, start + 0.15);
      });

      // 85% -> 100%: Center-origin glowing orange sphere wipe into Dashboard
      tl.to(
        wipeEl,
        {
          scale: 20,
          opacity: 0.95,
          duration: 0.1,
          ease: "power2.in",
        },
        0.84
      )
        .to(
          rocketEl,
          { autoAlpha: 0, duration: 0.06, ease: "none" },
          0.86
        )
        .to(
          wipeEl,
          {
            opacity: 0,
            duration: 0.06,
            ease: "power1.out",
          },
          0.94
        );
    }, triggerRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  const scrollToDashboard = () => {
    const el = document.getElementById("mission-dashboard");
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      ref={triggerRef}
      aria-label="Microgravity shuttle combustion narrative"
      className="relative z-10 h-[380vh] w-full"
    >
      {/* Pinned Viewport Stage */}
      <div
        ref={pinRef}
        className="relative flex h-screen w-full items-center justify-center overflow-hidden px-4 sm:px-8"
      >
        {/* Top Telemetry Bar */}
        <div className="pointer-events-none absolute top-5 inset-x-4 sm:inset-x-8 z-30 flex items-center justify-between gap-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-white/5 backdrop-blur-md border border-white/10 px-4 py-1.5">
            <span className="h-2 w-2 rounded-full bg-flame-orange shadow-[0_0_10px_#FF6B00]" />
            <span className="font-mono text-[11px] tracking-[0.18em] text-white/90 uppercase">
              NASA SPACE APPS 2026 · FLAME IN FREEFALL
            </span>
          </div>

          <div className="pointer-events-auto flex items-center gap-3">
            <div className="hidden md:flex items-center gap-4 rounded-full bg-white/5 backdrop-blur-md border border-white/10 px-4 py-1.5 font-mono text-[11px] text-white/75">
              <span>
                ACCEL:{" "}
                <strong className="text-flame-orange">{telemetry.gravityLabel}</strong>
              </span>
              <span className="text-white/25">|</span>
              <span>{telemetry.regimeLabel}</span>
              <span className="text-white/25">|</span>
              <span>{telemetry.scrollPct}%</span>
            </div>

            <button
              type="button"
              onClick={scrollToDashboard}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/5 backdrop-blur-md border border-flame-orange/45 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-flame-orange transition hover:bg-flame-orange/15 hover:border-flame-orange cursor-pointer"
            >
              <span>Terminal</span>
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Opening Hero Thesis (0% scroll) */}
        <div
          ref={heroHeaderRef}
          className="pointer-events-none absolute top-20 sm:top-24 inset-x-4 z-20 mx-auto max-w-3xl text-center"
        >
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-flame-orange mb-3">
            MICROGRAVITY COMBUSTION INTELLIGENCE
          </p>
          <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight text-white">
            When Gravity Vanishes,{" "}
            <span className="text-flame-orange orange-glow-text">
              Fire Rewrites the Rules.
            </span>
          </h1>
          <p className="mt-3 mx-auto max-w-xl text-sm sm:text-base text-white/70">
            Scroll to ignite the shuttle stack from launchpad ascent into orbital freefall—before entering the NASA PSI combustion telemetry terminal.
          </p>
        </div>

        {/* Moving Shuttle Stack + Attached Orange Ignition Plume */}
        <div
          ref={rocketWrapRef}
          className="relative z-20 flex flex-col items-center justify-center will-change-transform"
        >
          <div className="relative flex items-center justify-center">
            {/* Ambient Nozzle Thermal Glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 h-48 w-48 rounded-full bg-flame-orange/15 blur-3xl"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/rocket.svg"
              alt="Space Shuttle stack with external tank and twin solid rocket boosters"
              width={260}
              height={400}
              className="h-[210px] sm:h-[280px] w-auto select-none drop-shadow-[0_0_24px_rgba(255,107,0,0.24)]"
            />

            {/* Orange Ignition Plume Locked to Shuttle Nozzles */}
            <div className="pointer-events-none absolute -bottom-32 sm:-bottom-36 left-1/2 -translate-x-1/2 flex items-center justify-center">
              <MicrogravityFire
                ignitionRef={ignitionRef}
                className="h-44 w-44 sm:h-56 sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Scroll-Scrubbed Narrative Blocks (Clear of Diagonal Corridor) */}
        <div className="pointer-events-none absolute inset-0 z-30 mx-auto max-w-6xl px-4 sm:px-8">
          {STORY_CHAPTERS.map((chapter, idx) => (
            <div
              key={chapter.id}
              ref={(el) => {
                chapterRefs.current[idx] = el;
              }}
              className={`absolute w-[calc(100%-2rem)] sm:w-[350px] lg:w-[390px] left-4 sm:left-auto ${
                chapter.placement === "top-right"
                  ? "bottom-12 sm:bottom-auto sm:top-28 sm:right-8"
                  : "bottom-12 sm:bottom-14 sm:left-8"
              }`}
            >
              <div className="rounded-2xl bg-black/75 backdrop-blur-md border border-white/15 p-5 shadow-glass">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-[10px] tracking-[0.2em] text-flame-orange uppercase">
                    {chapter.tag}
                  </span>
                  <ChapterIcon icon={chapter.icon} />
                </div>
                <h2 className="font-display text-lg sm:text-xl font-semibold text-white">
                  {chapter.title}
                </h2>
                <p className="mt-1.5 font-mono text-[11px] text-flame-amber">
                  {chapter.metric}
                </p>
                <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-white/75">
                  {chapter.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 84-100% Center-Origin Orange Wipe Sphere */}
        <div
          ref={wipeSphereRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-40 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full will-change-transform"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.96) 0%, rgba(255,176,32,0.94) 28%, rgba(255,107,0,0.88) 58%, rgba(255,51,0,0.72) 78%, rgba(0,0,0,0) 100%)",
          }}
        />

        {/* Bottom Scroll Cue */}
        <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 z-20 hidden sm:flex flex-col items-center gap-1 font-mono text-[10px] tracking-[0.22em] text-white/50 uppercase">
          <span>Scroll To Ignite Shuttle</span>
          <span className="h-5 w-px bg-gradient-to-b from-flame-orange/85 to-transparent" />
        </div>
      </div>
    </section>
  );
}
