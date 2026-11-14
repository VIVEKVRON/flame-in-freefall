import { RocketScrollStory } from "@/components/animations/RocketScrollStory";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { EnvironmentProvider } from "@/lib/EnvironmentContext";

export default function HomePage() {
  return (
    <EnvironmentProvider initialEnvironment="moonbase">
      <main className="relative min-h-screen w-full bg-transparent">
        <RocketScrollStory />
        <DashboardGrid />
      </main>
    </EnvironmentProvider>
  );
}
