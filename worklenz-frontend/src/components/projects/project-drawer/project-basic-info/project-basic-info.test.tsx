import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Form } from 'antd';
import { describe, expect, it, vi } from 'vitest';

import ProjectBasicInfo from './project-basic-info';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

const TestForm = ({ disabled, onFinish }: { disabled: boolean; onFinish: (values: unknown) => void }) => {
  const [form] = Form.useForm();
  return (
    <Form form={form} onFinish={onFinish} initialValues={{ name: 'Project', color_code: '#154c9b' }}>
      <ProjectBasicInfo editMode={false} project={null} form={form} disabled={disabled} />
      <button type="submit">Save</button>
    </Form>
  );
};

describe('Project reference', () => {
  it('accepts a formatted reference when creating a project', async () => {
    const onFinish = vi.fn();
    render(<TestForm disabled={false} onFinish={onFinish} />);
    fireEvent.change(screen.getByLabelText('Project reference'), {
      target: { value: 'XX/NCPL/SG0001/0001/2027' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({
      project_reference: 'XX/NCPL/SG0001/0001/2027',
    })));
  });

  it('disables the input when project editing is unavailable', () => {
    render(<TestForm disabled onFinish={vi.fn()} />);
    expect(screen.getByLabelText('Project reference')).toBeDisabled();
  });
});
