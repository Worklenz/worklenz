import type { PortalProject } from '@/types/client-portal/v2';
import { DiscussionsPanel } from '../../discussions/DiscussionsPanel';

interface DiscussionsTabProps {
  project: PortalProject;
}

/** The same inbox as the Discussions page, limited to this project. */
export const DiscussionsTab = ({ project }: DiscussionsTabProps) => (
  <DiscussionsPanel projectId={project.id} embedded />
);
