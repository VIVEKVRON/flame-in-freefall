"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
import {
  type MissionEnvironmentId,
  type EnvironmentPreset,
  ENVIRONMENT_PRESETS,
} from "./api";

interface EnvironmentContextValue {
  environment: MissionEnvironmentId;
  setEnvironment: (env: MissionEnvironmentId) => void;
  preset: EnvironmentPreset;
}

const EnvironmentContext = createContext<EnvironmentContextValue | undefined>(
  undefined
);

export function EnvironmentProvider({
  children,
  initialEnvironment = "moonbase",
}: {
  children: React.ReactNode;
  initialEnvironment?: MissionEnvironmentId;
}) {
  const [environment, setEnvironment] =
    useState<MissionEnvironmentId>(initialEnvironment);

  const preset = useMemo(
    () => ENVIRONMENT_PRESETS[environment],
    [environment]
  );

  const value = useMemo(
    () => ({
      environment,
      setEnvironment,
      preset,
    }),
    [environment, preset]
  );

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment(): EnvironmentContextValue {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error(
      "useEnvironment must be used within an EnvironmentProvider"
    );
  }
  return context;
}
