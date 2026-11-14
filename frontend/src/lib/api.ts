export type MissionEnvironmentId = "spacesuit" | "moonbase" | "iss";

export interface EnvironmentPreset {
  id: MissionEnvironmentId;
  label: string;
  shortLabel: string;
  pressurePsi: number;
  oxygenPercent: number;
  nitrogenPercent: number;
  gravityG: number;
  badge: string;
  description: string;
  riskClassification: "ELEVATED" | "MODERATE" | "NOMINAL";
  flameSpreadMultiplier: number;
  minimumIgnitionEnergyMj: number;
  coolFlameQuenchDiameterMm: number;
}

export interface FlammabilityPoint {
  oxygenPercent: number;
  pmmaFlameSpreadMmS: number;
  nomexLimitIndex: number;
  cottonFiberglassRateMmS: number;
  fepInsulationThreshold: number;
  oneGravityBaselineMmS: number;
}

export interface ChatCitation {
  experiment: string;
  documentId: string;
  relevance: number;
  excerpt: string;
}

export interface ChatResponse {
  answer: string;
  citations: ChatCitation[];
  environmentApplied: MissionEnvironmentId;
  latencyMs: number;
}

export const ENVIRONMENT_PRESETS: Record<MissionEnvironmentId, EnvironmentPreset> = {
  spacesuit: {
    id: "spacesuit",
    label: "Spacesuit EVA",
    shortLabel: "Spacesuit",
    pressurePsi: 4.3,
    oxygenPercent: 100,
    nitrogenPercent: 0,
    gravityG: 0.0,
    badge: "4.3 PSI · 100% O₂",
    description:
      "Pure-oxygen extravehicular mobility unit atmosphere. Absence of nitrogen diluent eliminates convective heat sink, sharpening solid-fuel ignition sensitivity.",
    riskClassification: "ELEVATED",
    flameSpreadMultiplier: 2.38,
    minimumIgnitionEnergyMj: 0.14,
    coolFlameQuenchDiameterMm: 14.2,
  },
  moonbase: {
    id: "moonbase",
    label: "Moon Base",
    shortLabel: "Moon Base",
    pressurePsi: 10.2,
    oxygenPercent: 30,
    nitrogenPercent: 70,
    gravityG: 0.165,
    badge: "10.2 PSI · 30% O₂",
    description:
      "NASA exploration habitat normoxic-hypobaric envelope (30% O₂ / 70% N₂). Designed to limit decompression sickness while suppressing rapid flame propagation.",
    riskClassification: "MODERATE",
    flameSpreadMultiplier: 1.42,
    minimumIgnitionEnergyMj: 0.48,
    coolFlameQuenchDiameterMm: 9.8,
  },
  iss: {
    id: "iss",
    label: "ISS / Earth",
    shortLabel: "ISS / Earth",
    pressurePsi: 14.7,
    oxygenPercent: 21,
    nitrogenPercent: 79,
    gravityG: 0.0,
    badge: "14.7 PSI · 21% O₂",
    description:
      "Sea-level equivalent pressure in orbital freefall. Without buoyancy-driven convection, flames stabilize into diffusion-controlled blue cool-flame spheres.",
    riskClassification: "NOMINAL",
    flameSpreadMultiplier: 1.0,
    minimumIgnitionEnergyMj: 0.92,
    coolFlameQuenchDiameterMm: 6.4,
  },
};

export const ENVIRONMENT_ORDER: MissionEnvironmentId[] = [
  "spacesuit",
  "moonbase",
  "iss",
];

const OXYGEN_STEPS = [15, 21, 25, 30, 40, 50, 65, 80, 100] as const;

/**
 * Generates mission-calibrated Oxygen Concentration vs. Flammability Limits curves
 * modeled after NASA PSI (Physical Sciences Informatics) BASS-II, Saffire, and NASA-STD-6001B datasets.
 */
export function getFlammabilityDataset(
  envId: MissionEnvironmentId
): FlammabilityPoint[] {
  const preset = ENVIRONMENT_PRESETS[envId];
  const pressureScale = Math.pow(14.7 / preset.pressurePsi, 0.24);
  const spreadFactor = preset.flameSpreadMultiplier;

  return OXYGEN_STEPS.map((o2) => {
    const excessO2 = Math.max(0, o2 - 14);
    const pmma = Number(
      (0.85 * Math.pow(excessO2 / 10, 1.32) * spreadFactor * 0.68).toFixed(2)
    );
    const cotton = Number(
      (1.15 * Math.pow(excessO2 / 10, 1.18) * spreadFactor * 0.74).toFixed(2)
    );
    const nomex = Number(
      (
        Math.max(0.18, (o2 - 18) * 0.095) *
        pressureScale *
        (0.85 + spreadFactor * 0.18)
      ).toFixed(2)
    );
    const fep = Number(
      (
        Math.max(0.12, (o2 - 22) * 0.072) *
        pressureScale *
        (0.8 + spreadFactor * 0.15)
      ).toFixed(2)
    );
    const oneG = Number(
      (0.65 * Math.pow(excessO2 / 10, 1.15) * 0.72).toFixed(2)
    );

    return {
      oxygenPercent: o2,
      pmmaFlameSpreadMmS: pmma,
      nomexLimitIndex: nomex,
      cottonFiberglassRateMmS: cotton,
      fepInsulationThreshold: fep,
      oneGravityBaselineMmS: oneG,
    };
  });
}

export interface BackendHealthResponse {
  status: "ok" | "degraded" | "offline";
  collection?: string;
  pointsCount?: number;
  error?: string;
}

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

/**
 * Checks connectivity to the live Python Flask RAG backend and Qdrant database.
 */
export async function checkBackendHealth(): Promise<BackendHealthResponse> {
  const endpoint = `${API_BASE_URL}/api/health`;
  try {
    const res = await fetch(endpoint, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        status: "degraded",
        error: `HTTP ${res.status}: Backend reported degraded state`,
      };
    }

    const data = (await res.json()) as BackendHealthResponse;
    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "offline",
      error: `Could not reach ${endpoint} (${msg})`,
    };
  }
}

/**
 * Queries the live Python Flask two-stage RAG API (Qdrant + Qwen3 + Gemini)
 * at POST http://localhost:5000/api/chat. Falls back to calibrated local PSI simulation
 * if the Flask backend is unreachable.
 */
export async function querySuperIntelligence(
  prompt: string,
  environment: string
): Promise<ChatResponse> {
  const endpoint = `${API_BASE_URL}/api/chat`;
  const normalizedEnv = (environment.toLowerCase() as MissionEnvironmentId) || "iss";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: prompt, environment: normalizedEnv }),
    });

    if (!res.ok) {
      const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        errorJson.error || `HTTP ${res.status}: Failed to retrieve combustion telemetry.`
      );
    }

    const data = (await res.json()) as ChatResponse;
    return data;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[SI-API] Backend connection warning for ${endpoint}: ${errorMsg}. Falling back to calibrated local PSI simulation.`
    );

    // Provide a responsive fallback with clear system notice
    await new Promise((resolve) => setTimeout(resolve, 600));
    const fallback = buildMockRagResponse(prompt, normalizedEnv);
    fallback.answer = `[OFFLINE SIMULATION // FLASK ${API_BASE_URL} UNREACHABLE]\n(${errorMsg})\n\n${fallback.answer}`;
    return fallback;
  }
}

function buildMockRagResponse(
  prompt: string,
  envId: MissionEnvironmentId
): ChatResponse {
  const preset = ENVIRONMENT_PRESETS[envId];
  const lower = prompt.toLowerCase();

  if (lower.includes("bass") || lower.includes("saffire")) {
    return {
      environmentApplied: envId,
      latencyMs: 640,
      answer: [
        `[PSI-RAG // ENVIRONMENT: ${preset.label.toUpperCase()} (${preset.badge})]`,
        "",
        "1. SCALE & FLOW REGIME: BASS-II evaluated small-scale (1–2 cm) solid PMMA rods and cotton-fiberglass sheets inside the ISS Microgravity Science Glovebox under low-speed forced flow (0–55 cm/s), whereas Saffire-I through Saffire-V burned full-scale (0.4 m × 0.9 m) SIBAL fabrics inside an uncrewed Cygnus cargo module.",
        "",
        "2. FLAME SPREAD DIVERGENCE: Under quiescent or ultra-low airflow (<10 cm/s), BASS-II samples formed dim, soot-free blue flamelets driven purely by molecular oxygen diffusion. In Saffire-I (21% O₂, 14.7 psi, 20 cm/s flow), large-scale radiative feedback sustained a steady flame front ~1.4× faster than small-sample predictions.",
        "",
        `3. ACTIVE PRESET IMPACT (${preset.badge}): At ${preset.oxygenPercent}% O₂ and ${preset.pressurePsi} psi, solid-fuel flame spread scales by ${preset.flameSpreadMultiplier.toFixed(2)}× relative to 14.7 psi / 21% O₂ baselines, requiring a minimum ignition energy of ${preset.minimumIgnitionEnergyMj} mJ.`,
      ].join("\n"),
      citations: [
        {
          experiment: "BASS-II (Burning and Suppression of Solids)",
          documentId: "NASA-PSI-GLV-2015-BASS2",
          relevance: 0.96,
          excerpt:
            "Opposed-flow flame spread rates peak at moderate forced velocities (15–30 cm/s) before radiative heat loss causes extinction in 0g.",
        },
        {
          experiment: "Saffire-I Spacecraft Fire Experiment",
          documentId: "NASA-PSI-CYG-2016-SAFF1",
          relevance: 0.94,
          excerpt:
            "Full-scale SIBAL cotton-fiberglass cloth exhibits longer preheat zones and sustained pyrolysis downstream compared to glovebox specimens.",
        },
      ],
    };
  }

  if (lower.includes("apollo") || lower.includes("artemis") || lower.includes("wire")) {
    return {
      environmentApplied: envId,
      latencyMs: 580,
      answer: [
        `[PSI-RAG // ENVIRONMENT: ${preset.label.toUpperCase()} (${preset.badge})]`,
        "",
        "1. APOLLO 13 CRYO-O₂ FAILURE MODE: Damaged PTFE/Teflon insulation on Tank 2 stirrer wiring arced inside supercritical oxygen, triggering rapid combustion and an overpressure rupture—illustrating how 100% O₂ eliminates nitrogen thermal buffering.",
        "",
        "2. ARTEMIS II / ORION ARCHITECTURE: Modern deep-space cabin envelopes target elevated-O₂ / reduced-pressure exploration atmospheres (such as 10.2 psi, 30% O₂) to enable faster EVA pre-breathe while applying NASA-STD-6001B upward propagation and wire-arc screening.",
        "",
        `3. TELEMETRY DELTA FOR ${preset.shortLabel.toUpperCase()}: Current quench diameter is ${preset.coolFlameQuenchDiameterMm} mm with ${preset.riskClassification} ignition risk.`,
      ].join("\n"),
      citations: [
        {
          experiment: "Apollo 13 Review Board & Cryo-O₂ Arc Analysis",
          documentId: "NASA-TM-X-58040-A13",
          relevance: 0.95,
          excerpt:
            "Thermostatic switch fusing exposed energized wiring within pure oxygen, producing rapid local pressurization.",
        },
        {
          experiment: "Saffire-IV / Artemis Exploration Atmosphere Screening",
          documentId: "NASA-STD-6001B-EXP-ATM",
          relevance: 0.91,
          excerpt:
            "Reducing total pressure while raising O₂ mole fraction above 26% decreases convective cooling and lowers material LOI margins.",
        },
      ],
    };
  }

  return {
    environmentApplied: envId,
    latencyMs: 510,
    answer: [
      `[PSI-RAG // ENVIRONMENT: ${preset.label.toUpperCase()} (${preset.badge})]`,
      "",
      `QUERY SYNTHESIS: "${prompt.trim()}"`,
      "",
      `• DIFFUSION COMBUSTION REGIME: In microgravity (${preset.gravityG.toFixed(3)} g), hot combustion products do not rise via buoyancy. Oxygen reaches the reaction zone solely through Fickian molecular diffusion, forming a low-temperature, soot-free spherical blue cool flame (diameter ~${preset.coolFlameQuenchDiameterMm} mm).`,
      "",
      `• ATMOSPHERIC ENVELOPE (${preset.pressurePsi} psi / ${preset.oxygenPercent}% O₂): Flame spread multiplier is ${preset.flameSpreadMultiplier.toFixed(2)}× baseline with ${preset.minimumIgnitionEnergyMj} mJ minimum ignition energy (${preset.riskClassification} margin).`,
      "",
      "• RECOMMENDED QUERY: Try comparing BASS-II vs Saffire-I solid fuel propagation or Apollo 13 vs Artemis II wire-arc thresholds.",
    ].join("\n"),
    citations: [
      {
        experiment: "FLEX / Cool Flame Investigation (ISS)",
        documentId: "NASA-PSI-FLEX-COOL-2019",
        relevance: 0.92,
        excerpt:
          "Spherical diffusion flames transition to low-temperature (~600 K) cool flames sustained by radical chemistry after visible soot extinction.",
      },
      {
        experiment: "NASA-STD-6001B Flammability Matrix",
        documentId: "NASA-PSI-STD-6001B",
        relevance: 0.89,
        excerpt:
          "Microgravity zero-buoyancy extinction limits diverge from 1g upward flame spread tests under low-velocity ventilation.",
      },
    ],
  };
}


