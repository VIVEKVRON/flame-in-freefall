"use client";

import { motion } from "motion/react";
import { Globe, Moon, Shield } from "lucide-react";
import {
  ENVIRONMENT_ORDER,
  ENVIRONMENT_PRESETS,
  type MissionEnvironmentId,
} from "@/lib/api";
import { useEnvironment } from "@/lib/EnvironmentContext";

interface EnvironmentToggleProps {
  activeEnv?: MissionEnvironmentId;
  onChange?: (env: MissionEnvironmentId) => void;
}

function EnvIcon({ id, active }: { id: MissionEnvironmentId; active: boolean }) {
  const cls = `h-4 w-4 ${active ? "text-flame-orange" : "text-white/60"}`;
  if (id === "spacesuit") return <Shield className={cls} />;
  if (id === "moonbase") return <Moon className={cls} />;
  return <Globe className={cls} />;
}

export function EnvironmentToggle({
  activeEnv: propActiveEnv,
  onChange: propOnChange,
}: EnvironmentToggleProps = {}) {
  let contextEnv: MissionEnvironmentId | undefined;
  let contextSetEnv: ((env: MissionEnvironmentId) => void) | undefined;
  try {
    const ctx = useEnvironment();
    contextEnv = ctx.environment;
    contextSetEnv = ctx.setEnvironment;
  } catch {
    // Fallback if rendered outside EnvironmentProvider
  }

  const activeEnv = propActiveEnv ?? contextEnv ?? "moonbase";
  const onChange = propOnChange ?? contextSetEnv ?? (() => {});
  return (
    <div
      role="radiogroup"
      aria-label="Mission atmospheric environment presets"
      className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-1.5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10"
    >
      {ENVIRONMENT_ORDER.map((envId) => {
        const preset = ENVIRONMENT_PRESETS[envId];
        const isActive = activeEnv === envId;

        return (
          <button
            key={envId}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(envId)}
            className={`relative flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors cursor-pointer ${
              isActive
                ? "text-white"
                : "text-white/65 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            {isActive ? (
              <motion.span
                layoutId="env-active-pill"
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                className="absolute inset-0 rounded-xl bg-flame-orange/14 border border-flame-orange/65 shadow-orange-ring"
              />
            ) : null}

            <div className="relative z-10 flex items-center gap-3 min-w-0">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                  isActive
                    ? "border-flame-orange/55 bg-flame-orange/15"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <EnvIcon id={envId} active={isActive} />
              </div>
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold truncate">
                  {preset.shortLabel}
                </p>
                <p className="font-mono text-[11px] text-flame-amber truncate">
                  {preset.badge}
                </p>
              </div>
            </div>

            <span
              className={`relative z-10 shrink-0 rounded-md px-2 py-0.5 font-mono text-[10px] tracking-wider border ${
                preset.riskClassification === "ELEVATED"
                  ? "border-critical-rose/40 bg-critical-rose/10 text-critical-rose"
                  : preset.riskClassification === "MODERATE"
                  ? "border-flame-amber/40 bg-flame-amber/10 text-flame-amber"
                  : "border-flame-orange/40 bg-flame-orange/10 text-flame-orange"
              }`}
            >
              {preset.riskClassification}
            </span>
          </button>
        );
      })}
    </div>
  );
}
