"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  ENVIRONMENT_PRESETS,
  getFlammabilityDataset,
  type MissionEnvironmentId,
} from "@/lib/api";

interface FlammabilityChartProps {
  environment: MissionEnvironmentId;
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  label?: number | string;
  payload?: TooltipPayloadEntry[];
}

function TelemetryTooltip({ active, label, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-xl bg-black/90 backdrop-blur-md border border-flame-orange/45 px-3.5 py-2.5 shadow-orange-glow">
      <p className="font-mono text-[11px] uppercase tracking-wider text-flame-orange mb-1.5">
        O₂ Concentration: {label}%
      </p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div
            key={entry.name}
            className="flex items-center justify-between gap-5 font-mono text-xs"
          >
            <span className="flex items-center gap-2 text-white/80">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="text-white font-semibold">
              {entry.value.toFixed(2)} mm/s
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const emptySubscribe = () => () => {};

export function FlammabilityChart({ environment }: FlammabilityChartProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const preset = ENVIRONMENT_PRESETS[environment];
  const data = useMemo(() => getFlammabilityDataset(environment), [environment]);

  return (
    <GlassCard
      eyebrow="NASA-STD-6001B // FLAMMABILITY TELEMETRY"
      title="Oxygen Concentration vs. Microgravity Flame Spread"
      headerAction={
        <span className="inline-flex items-center gap-2 rounded-full border border-flame-orange/40 bg-flame-orange/10 px-3 py-1 font-mono text-[11px] text-flame-orange">
          ACTIVE O₂ LINE: {preset.oxygenPercent}%
        </span>
      }
      className="h-full flex flex-col"
    >
      <p className="text-xs sm:text-sm text-white/70 mb-4 leading-relaxed">
        {preset.description}
      </p>

      <div className="h-[310px] sm:h-[340px] w-full">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 14, right: 16, left: -12, bottom: 8 }}
            >
              <CartesianGrid
                stroke="rgba(255, 107, 0, 0.14)"
                strokeDasharray="3 5"
                vertical={true}
              />
              <XAxis
                dataKey="oxygenPercent"
                stroke="rgba(255, 255, 255, 0.45)"
                tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                label={{
                  value: "O₂ CONCENTRATION (%)",
                  position: "insideBottom",
                  offset: -4,
                  fill: "rgba(255, 140, 40, 0.85)",
                  fontSize: 10,
                }}
              />
              <YAxis
                stroke="rgba(255, 255, 255, 0.45)"
                tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                tickFormatter={(v) => `${v}`}
                label={{
                  value: "SPREAD (mm/s)",
                  angle: -90,
                  position: "insideLeft",
                  offset: 18,
                  fill: "rgba(255, 255, 255, 0.65)",
                  fontSize: 10,
                }}
              />
              <Tooltip content={<TelemetryTooltip />} />
              <ReferenceLine
                x={preset.oxygenPercent}
                stroke="#FF6B00"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                label={{
                  value: `${preset.shortLabel} (${preset.oxygenPercent}% O₂)`,
                  position: "top",
                  fill: "#FF6B00",
                  fontSize: 10,
                }}
              />
              <Line
                type="monotone"
                dataKey="pmmaFlameSpreadMmS"
                name="PMMA Solid (0g)"
                stroke="#FF6B00"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#FF6B00", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#FFFFFF", stroke: "#FF6B00", strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="cottonFiberglassRateMmS"
                name="SIBAL Cotton-FG (0g)"
                stroke="#FFFFFF"
                strokeWidth={2}
                dot={{ r: 2.5, fill: "#FFFFFF", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#FFB020" }}
              />
              <Line
                type="monotone"
                dataKey="nomexLimitIndex"
                name="Nomex HT90 Limit"
                stroke="#FFB020"
                strokeWidth={1.8}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="oneGravityBaselineMmS"
                name="1g Buoyant Baseline"
                stroke="#FB7185"
                strokeWidth={1.6}
                strokeDasharray="5 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full rounded-xl border border-white/10 bg-white/[0.02] animate-pulse" />
        )}
      </div>

      {/* Legend Footer */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-3 font-mono text-[11px] text-white/75">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 bg-flame-orange shadow-[0_0_8px_#FF6B00]" />
          PMMA Solid (0g)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 bg-white" />
          SIBAL Cotton-Fiberglass
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 bg-flame-amber" />
          Nomex HT90
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 border-t border-dashed border-rose-400" />
          1g Earth Baseline
        </span>
      </div>
    </GlassCard>
  );
}
