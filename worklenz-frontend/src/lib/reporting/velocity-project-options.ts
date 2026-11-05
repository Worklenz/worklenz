import type { FilterOption } from '@/components/common/filters/MultiSelectFilterPill';

export interface VelocityOverviewProject {
  id: string;
  name: string;
  /** Optional; both software and general projects must remain selectable. */
  project_type?: string | null;
}

/**
 * Velocity supports software sprints and general-project phases.
 * Do not filter by project_type — excluding general projects makes phase velocity inaccessible.
 */
export const mapOverviewProjectsToVelocityOptions = (
  projects: VelocityOverviewProject[]
): FilterOption[] => {
  const options: FilterOption[] = [];
  const seen = new Set<string>();
  for (const project of projects) {
    if (!project.id || seen.has(project.id)) continue;
    seen.add(project.id);
    options.push({ value: project.id, label: project.name });
  }
  return options;
};
