import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MoveTaskProjectModal } from './MoveTaskProjectModal';

const mocks = vi.hoisted(() => ({
  getProjects: vi.fn(), getStatuses: vi.fn(), getPhases: vi.fn(), getColumns: vi.fn(), move: vi.fn(),
  error: vi.fn(), success: vi.fn(), warning: vi.fn(), track: vi.fn(),
  t: (_key: string, options: { defaultValue: string }) => options.defaultValue,
}));
vi.mock('@/api/projects/projects.api.service', () => ({ projectsApiService: { getProjects: mocks.getProjects } }));
vi.mock('@/api/taskAttributes/status/status.api.service', () => ({ statusApiService: { getStatuses: mocks.getStatuses } }));
vi.mock('@/api/taskAttributes/phases/phases.api.service', () => ({ phasesApiService: { getPhasesByProjectId: mocks.getPhases } }));
vi.mock('@/api/tasks/tasks-custom-columns.service', () => ({ tasksCustomColumnsService: { getCustomColumns: mocks.getColumns } }));
vi.mock('@/api/tasks/tasks.api.service', () => ({ tasksApiService: { moveTasksToProject: mocks.move } }));
vi.mock('@/hooks/useMixpanelTracking', () => ({ useMixpanelTracking: () => ({ trackMixpanelEvent: mocks.track }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mocks.t }) }));
vi.mock('@/shared/antd-imports', () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Alert: ({ message }: { message: React.ReactNode }) => <div>{message}</div>,
    Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => <button onClick={onClick} disabled={disabled}>{children}</button>,
    Modal: ({ open, children, footer }: { open: boolean; children: React.ReactNode; footer: React.ReactNode }) => open ? <div role="dialog">{children}{footer}</div> : null,
    Select: ({ options, value, onChange, placeholder }: { options: Array<{ label: string; value: string }>; value?: string; onChange: (value: string) => void; placeholder?: string }) => <select aria-label={placeholder} value={value ?? ''} onChange={event => onChange(event.target.value)}><option value="">{placeholder}</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>,
    Switch: ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />,
    Space: Box, Spin: Box, Tag: Box, Typography: { Text: Box },
    message: { error: mocks.error, success: mocks.success, warning: mocks.warning },
  };
});

describe('move tasks dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProjects.mockResolvedValue({ done: true, body: { data: [{ id: 'source', name: 'Source' }, { id: 'destination', name: 'Destination' }] } });
    mocks.getStatuses.mockImplementation(async (project: string) => ({ done: true, body: [{ id: project === 'source' ? 'source-status' : 'destination-status', name: 'Open' }] }));
    mocks.getPhases.mockResolvedValue({ done: true, body: [] });
    mocks.getColumns.mockResolvedValue({ done: true, body: [] });
  });

  it('maps statuses and submits the selected task to the destination', async () => {
    const onMoved = vi.fn();
    mocks.move.mockResolvedValue({ done: true, body: { moved_task_ids: ['task'], unmoved_task_ids: [], warnings: [], destination_refresh_hint: { project_id: 'destination' } } });
    render(<MoveTaskProjectModal open sourceProjectId="source" taskIds={['task']} selectedTasks={[{ id: 'task', name: 'Example', status_id: 'source-status' }]} onCancel={vi.fn()} onMoved={onMoved} />);
    expect(screen.getByText('Release assignments will be cleared and will not be restored if tasks are moved back.')).toBeInTheDocument();
    const destination = await screen.findByRole('combobox', { name: 'Select destination project' });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Destination' })).toBeInTheDocument());
    fireEvent.change(destination, { target: { value: 'destination' } });
    const submit = screen.getByRole('button', { name: 'Move tasks' });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => expect(onMoved).toHaveBeenCalled());
    expect(mocks.move).toHaveBeenCalledWith(expect.objectContaining({ task_ids: ['task'], source_project_id: 'source', destination_project_id: 'destination', mapping: expect.objectContaining({ status: { 'source-status': 'destination-status' } }) }));
  });

  it('reports a failed move and leaves the dialog open', async () => {
    const onMoved = vi.fn();
    mocks.move.mockResolvedValue({ done: false, body: null });
    render(<MoveTaskProjectModal open sourceProjectId="source" taskIds={['task']} selectedTasks={[{ id: 'task', name: 'Example', status_id: 'source-status' }]} onCancel={vi.fn()} onMoved={onMoved} />);
    const destination = await screen.findByRole('combobox', { name: 'Select destination project' });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Destination' })).toBeInTheDocument());
    fireEvent.change(destination, { target: { value: 'destination' } });
    const submit = screen.getByRole('button', { name: 'Move tasks' });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Could not move tasks. Please try again.'));
    expect(onMoved).not.toHaveBeenCalled();
  });
});
