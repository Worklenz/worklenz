import { lazy, memo, Suspense, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { shallowEqual } from 'react-redux';
import { useAppSelector } from '@/hooks/useAppSelector';
import TaskDrawer from '@/components/task-drawer/task-drawer';
import { DeferredMount } from '@/components/task-list-v2/components/DeferredMount';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import { decodeHtmlEntities } from '@/utils/html-entities';

const PhaseDrawer = lazy(() => import('@/features/projects/singleProject/phase/PhaseDrawer'));
const StatusDrawer = lazy(
  () => import('@/components/project-task-filters/create-status-drawer/create-status-drawer')
);
const DeleteStatusDrawer = lazy(
  () => import('@/components/project-task-filters/delete-status-drawer/delete-status-drawer')
);
const InviteProjectMembers = lazy(
  () => import('@/components/common/invite-project-members/InviteProjectMembers')
);
const ImportTaskTemplate = lazy(() => import('@/components/task-templates/import-task-template'));
const SaveProjectAsTemplate = lazy(
  () => import('@/components/save-project-as-template/save-project-as-template')
);
const ProjectSettingsModal = lazy(() =>
  import('@/components/projects/project-settings-modal/ProjectSettingsModal').then(module => ({
    default: module.ProjectSettingsModal,
  }))
);
const handleSettingsClose = () => {};

/** Subscribe to dialog flags independently of the shell; load each dialog on first use. */
export const ProjectViewPortals = memo(() => {
  const state = useAppSelector(
    root => ({
      projectId: root.projectReducer.project?.id,
      projectName: root.projectReducer.project?.name,
      inviteOpen: root.projectMemberReducer.isDrawerOpen,
      phaseOpen: root.phaseReducer.isPhaseDrawerOpen,
      statusOpen: root.statusReducer.isCreateStatusDrawerOpen,
      deleteStatusOpen: root.deleteStatusReducer.isDeleteStatusDrawerOpen,
      settingsOpen: root.projectSettingsModalReducer.isOpen,
      importOpen: root.projectReducer.importTaskTemplateDrawerOpen,
      saveOpen: root.projectsReducer.isSaveAsTemplateDrawerOpen,
    }),
    shallowEqual
  );

  return (
    <>
      {/* The URL synchronization controller must remain mounted for direct task links. */}
      {createPortal(<TaskDrawer />, document.body, 'task-drawer')}
      {state.projectId && (
        <DialogPortal name="project-member-drawer" isOpen={state.inviteOpen}>
          <InviteProjectMembers
            projectId={state.projectId}
            projectName={decodeHtmlEntities(state.projectName) || ''}
          />
        </DialogPortal>
      )}
      <DialogPortal name="phase-drawer" isOpen={state.phaseOpen}>
        <PhaseDrawer />
      </DialogPortal>
      <DialogPortal name="status-drawer" isOpen={state.statusOpen}>
        <StatusDrawer />
      </DialogPortal>
      <DialogPortal name="delete-status-drawer" isOpen={state.deleteStatusOpen}>
        <DeleteStatusDrawer />
      </DialogPortal>
      <DialogPortal name="project-settings-modal" isOpen={state.settingsOpen}>
        <ProjectSettingsModal onClose={handleSettingsClose} />
      </DialogPortal>
      <DialogPortal name="import-task-template" isOpen={state.importOpen}>
        <ImportTaskTemplate />
      </DialogPortal>
      <DialogPortal name="save-project-as-template" isOpen={state.saveOpen}>
        <SaveProjectAsTemplate />
      </DialogPortal>
    </>
  );
});
ProjectViewPortals.displayName = 'ProjectViewPortals';

interface DialogPortalProps {
  name: string;
  isOpen: boolean;
  children: ReactNode;
}

const DialogPortal = ({ name, isOpen, children }: DialogPortalProps) =>
  createPortal(
    <DeferredMount isOpen={isOpen}>
      <Suspense fallback={<SuspenseFallback />}>{children}</Suspense>
    </DeferredMount>,
    document.body,
    name
  );
