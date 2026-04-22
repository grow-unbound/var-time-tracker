import { ProjectPlanningView } from "@/components/projects/project-planning-view";

export default function ProjectsPage(): JSX.Element {
  return (
    <section className="rounded-card border border-border bg-surface p-6 shadow-card">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">
        Project planning
      </p>
      <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-text-primary">
        Timeline
      </h1>
      <div className="mt-6">
        <ProjectPlanningView />
      </div>
    </section>
  );
}
