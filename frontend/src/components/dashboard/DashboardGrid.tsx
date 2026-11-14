"use client";

import { useState } from "react";
import { MotionConfig } from "motion/react";
import { Activity, Flame, Gauge, Zap } from "lucide-react";
import {
  ENVIRONMENT_PRESETS,
  type MissionEnvironmentId,
} from "@/lib/api";
import { useEnvironment } from "@/lib/EnvironmentContext";
import { EnvironmentToggle } from "./EnvironmentToggle";
import { FlammabilityChart } from "./FlammabilityChart";
import { ChatInterface } from "./ChatInterface";

export function DashboardGrid() {
  const { environment, setEnvironment, preset } = useEnvironment();

  const telemetryCards = [
    {
      label: "CABIN PRESSURE",
      value: `${preset.pressurePsi.toFixed(1)} psi`,
      sub: `${preset.nitrogenPercent}% N₂ diluent`,
      icon: Gauge,
    },
    {
      label: "OXYGEN FRACTION",
      value: `${preset.oxygenPercent}% O₂`,
      sub: `${preset.gravityG.toFixed(3)} g gravity`,
      icon: Activity,
    },
    {
      label: "SPREAD MULTIPLIER",
      value: `${preset.flameSpreadMultiplier.toFixed(2)}×`,
      sub: "Relative to 14.7 psi / 21% O₂",
      icon: Flame,
    },
    {
      label: "MIN IGNITION ENERGY",
      value: `${preset.minimumIgnitionEnergyMj.toFixed(2)} mJ`,
      sub: `Quench Ø ${preset.coolFlameQuenchDiameterMm} mm`,
      icon: Zap,
    },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <section
        id="mission-dashboard"
        aria-label="Microgravity combustion telemetry dashboard"
        className="relative z-10 min-h-screen w-full border-t border-white/10 bg-black/75 telemetry-grid-bg px-4 py-12 sm:px-8 lg:px-12"
      >
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Terminal Header */}
          <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-flame-orange">
                MISSION CONTROL // AEROSPACE COMBUSTION TERMINAL
              </p>
              <h2 className="mt-1 font-display text-2xl sm:text-4xl font-bold tracking-tight text-white">
                Flame in Freefall{" "}
                <span className="text-white/50 font-normal">
                  / PSI Telemetry Workbench
                </span>
              </h2>
            </div>

            <div className="inline-flex items-center gap-2.5 self-start rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-4 py-1.5 font-mono text-xs text-white/80">
              <span className="h-2 w-2 rounded-full bg-flame-orange shadow-[0_0_8px_#FF6B00]" />
              <span>DATASET: NASA PSI + SAFFIRE + BASS-II</span>
            </div>
          </header>

          {/* Environment Presets Bar */}
          <EnvironmentToggle
            activeEnv={environment}
            onChange={setEnvironment}
          />

          {/* Telemetry KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {telemetryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="glass-panel-interactive rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">
                      {card.label}
                    </span>
                    <Icon className="h-4 w-4 text-flame-orange" />
                  </div>
                  <p className="mt-2 font-display text-xl sm:text-2xl font-bold text-white">
                    {card.value}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-flame-amber/90">
                    {card.sub}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Primary Split Grid: Chart + SI Chat Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7">
              <FlammabilityChart environment={environment} />
            </div>
            <div className="lg:col-span-5">
              <ChatInterface environment={environment} />
            </div>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
