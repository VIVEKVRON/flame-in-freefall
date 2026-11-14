"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ChevronDown,
  CornerDownLeft,
  Cpu,
  FileText,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  ENVIRONMENT_PRESETS,
  checkBackendHealth,
  querySuperIntelligence,
  type BackendHealthResponse,
  type ChatCitation,
  type MissionEnvironmentId,
} from "@/lib/api";
import { useEnvironment } from "@/lib/EnvironmentContext";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: ChatCitation[];
  latencyMs?: number;
  isError?: boolean;
}

interface ChatInterfaceProps {
  environment?: MissionEnvironmentId;
}

const SAMPLE_QUERIES = [
  "Compare BASS-II and Saffire-I solid fuel results",
  "Analyze Apollo 13 vs Artemis II wire-arc thresholds",
  "Explain why 0g flames form cool diffusion spheres",
];

const DECRYPT_FRAMES = [
  "0x7F // QUERYING LOCAL QDRANT VECTOR SPACE (nasa_psi_combustion)...",
  "0x9C // EXECUTING QWEN3-RERANKER-0.6B LOGIT CROSS-ENCODER...",
  "0xE2 // SYNTHESIZING ZERO-BUOYANCY DIFFUSION TELEMETRY...",
  "0x00 // PARSING GROUNDED CITATION MANIFEST & CONFIDENCE SCORES...",
];

function CitationBadge({ citation }: { citation: ChatCitation }) {
  const [expanded, setExpanded] = useState(false);
  const matchPct = Math.min(100, Math.round(citation.relevance * 100));

  return (
    <div className="rounded-lg border border-white/10 bg-black/60 transition hover:border-flame-orange/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left font-mono text-[11px] cursor-pointer"
        aria-expanded={expanded}
      >
        <span className="inline-flex items-center gap-1.5 truncate text-white/90">
          <FileText className="h-3.5 w-3.5 shrink-0 text-flame-orange" />
          <span className="font-semibold text-white truncate">
            {citation.experiment}
          </span>
          <span className="text-white/40 text-[10px]">
            [{citation.documentId}]
          </span>
        </span>
        <span className="shrink-0 inline-flex items-center gap-1.5">
          <span className="rounded bg-flame-orange/15 px-1.5 py-0.5 text-[10px] text-flame-amber font-mono font-bold border border-flame-orange/30">
            {matchPct}% MATCH
          </span>
          <ChevronDown
            className={`h-3 w-3 text-white/50 transition-transform ${
              expanded ? "rotate-180 text-flame-orange" : ""
            }`}
          />
        </span>
      </button>

      {expanded && (
        <div className="border-t border-white/10 bg-white/[0.02] px-3 py-2 font-sans text-xs text-white/80 space-y-1 animate-in fade-in duration-200">
          <p className="font-mono text-[10px] uppercase text-flame-orange/90 tracking-wider">
            Supporting Telemetry Excerpt:
          </p>
          <p className="italic leading-relaxed text-white/70">
            &ldquo;{citation.excerpt}&rdquo;
          </p>
          <p className="font-mono text-[10px] text-white/40 pt-1">
            Verified Source ID:{" "}
            <span className="text-flame-amber">{citation.documentId}</span>
          </p>
        </div>
      )}
    </div>
  );
}

export function ChatInterface({ environment: propEnv }: ChatInterfaceProps = {}) {
  let contextEnv: MissionEnvironmentId | undefined;
  try {
    const ctx = useEnvironment();
    contextEnv = ctx.environment;
  } catch {
    // Graceful fallback if rendered outside provider
  }

  const activeEnvironment = propEnv ?? contextEnv ?? "moonbase";
  const preset = ENVIRONMENT_PRESETS[activeEnvironment];

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "boot-msg",
      role: "assistant",
      content:
        "SI-COMBUSTION TERMINAL ONLINE. Select a mission atmosphere above and query live NASA PSI datasets (BASS-II, Saffire-I–V, FLEX, Apollo 13, Artemis II).",
    },
  ]);
  const [input, setInput] = useState("");
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptStep, setDecryptStep] = useState(0);
  const [health, setHealth] = useState<BackendHealthResponse | null>(null);

  const listEndRef = useRef<HTMLDivElement>(null);
  const messageSeqRef = useRef<number>(0);

  const nextId = (prefix: string) => {
    messageSeqRef.current += 1;
    return `${prefix}-${messageSeqRef.current}`;
  };

  useEffect(() => {
    let isMounted = true;
    void checkBackendHealth().then((h) => {
      if (isMounted) setHealth(h);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isDecrypting) return;
    const interval = window.setInterval(() => {
      setDecryptStep((prev) => (prev + 1) % DECRYPT_FRAMES.length);
    }, 220);
    return () => window.clearInterval(interval);
  }, [isDecrypting]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, isDecrypting]);

  const submitQuery = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isDecrypting) return;

    const userMsg: ChatMessage = {
      id: nextId("u"),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsDecrypting(true);

    try {
      const response = await querySuperIntelligence(trimmed, activeEnvironment);
      const assistantMsg: ChatMessage = {
        id: nextId("a"),
        role: "assistant",
        content: response.answer,
        citations: response.citations,
        latencyMs: response.latencyMs,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorAssistantMsg: ChatMessage = {
        id: nextId("err"),
        role: "assistant",
        content: `Error communicating with Flask backend: ${errorMsg}`,
        isError: true,
      };
      setMessages((prev) => [...prev, errorAssistantMsg]);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitQuery(input);
  };

  const retryHealthCheck = () => {
    void checkBackendHealth().then(setHealth);
  };

  return (
    <GlassCard
      eyebrow="SUPER INTELLIGENCE // NASA PSI RAG"
      title="Combustion Intelligence Terminal"
      headerAction={
        <div className="flex items-center gap-2">
          {health?.status === "ok" ? (
            <span
              title={`Qdrant collection: ${health.collection}`}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              QDRANT LIVE ({health.pointsCount ?? 9} VECTORS)
            </span>
          ) : (
            <button
              type="button"
              onClick={retryHealthCheck}
              title="Click to re-check backend connection"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-flame-amber/30 bg-flame-amber/10 px-2 py-0.5 font-mono text-[10px] text-flame-amber hover:bg-flame-amber/20 cursor-pointer"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              <span>SI LOCAL READY</span>
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-flame-orange">
            <Cpu className="h-3.5 w-3.5" />
            {preset.shortLabel.toUpperCase()}
          </span>
        </div>
      }
      className="h-full flex flex-col"
    >
      {/* Quick Prompt Chips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {SAMPLE_QUERIES.map((q) => (
          <button
            key={q}
            type="button"
            disabled={isDecrypting}
            onClick={() => void submitQuery(q)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-left font-mono text-[11px] text-white/75 transition hover:border-flame-orange/55 hover:text-flame-amber disabled:opacity-45 cursor-pointer"
          >
            <Sparkles className="h-3 w-3 shrink-0 text-flame-orange" />
            <span>{q}</span>
          </button>
        ))}
      </div>

      {/* Scrollable Message Stream */}
      <div className="flex-1 min-h-[260px] max-h-[340px] overflow-y-auto space-y-3 rounded-xl border border-white/10 bg-black/60 p-3.5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl px-3.5 py-3 text-xs sm:text-sm leading-relaxed ${
              msg.role === "user"
                ? "ml-6 border border-flame-orange/40 bg-flame-orange/10 text-white"
                : msg.isError
                ? "mr-2 border border-critical-rose/40 bg-critical-rose/10 text-critical-rose"
                : "mr-2 border border-white/10 bg-white/[0.04] text-white/90"
            }`}
          >
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-white/50">
              <span>
                {msg.role === "user"
                  ? "ENGINEER // QUERY"
                  : msg.isError
                  ? "SYSTEM // WARNING"
                  : "SI-PSI // RESPONSE"}
              </span>
              {msg.latencyMs ? (
                <span className="text-flame-amber">{msg.latencyMs} ms</span>
              ) : null}
            </div>

            <p className="whitespace-pre-line font-sans">{msg.content}</p>

            {/* Clickable Grounded Citation Badges */}
            {msg.citations && msg.citations.length > 0 ? (
              <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-flame-orange/90">
                  Retrieved PSI Grounded Evidence:
                </p>
                <div className="space-y-1.5">
                  {msg.citations.map((c) => (
                    <CitationBadge key={c.documentId} citation={c} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}

        {/* Dynamic Telemetry Decryption Loading Animation */}
        {isDecrypting ? (
          <div className="mr-2 rounded-xl border border-flame-orange/45 bg-flame-orange/[0.08] px-3.5 py-3 font-mono text-xs text-flame-amber">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-flame-orange animate-ping" />
              <span>{DECRYPT_FRAMES[decryptStep]}</span>
            </div>
            <p className="mt-1.5 text-[10px] text-white/50 tracking-wider">
              PIPELINE: POST /api/chat // ENV={preset.id.toUpperCase()} ({preset.badge})
            </p>
          </div>
        ) : null}

        <div ref={listEndRef} />
      </div>

      {/* Chat Input Bar */}
      <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
        <label htmlFor="si-terminal-input" className="sr-only">
          Query microgravity combustion telemetry
        </label>
        <input
          id="si-terminal-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Query PSI database under ${preset.shortLabel} (${preset.badge})...`}
          className="flex-1 rounded-xl border border-white/15 bg-black/70 px-3.5 py-2.5 font-mono text-xs sm:text-sm text-white placeholder:text-white/40 focus:border-flame-orange focus:outline-none focus:ring-1 focus:ring-flame-orange/50"
        />
        <button
          type="submit"
          disabled={isDecrypting || input.trim().length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-flame-orange/65 bg-flame-orange/15 px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-flame-orange transition hover:bg-flame-orange/25 disabled:opacity-40 cursor-pointer"
        >
          <span>Send</span>
          <CornerDownLeft className="h-3.5 w-3.5" />
        </button>
      </form>
    </GlassCard>
  );
}
