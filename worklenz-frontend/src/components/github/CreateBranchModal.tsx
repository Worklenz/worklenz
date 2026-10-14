import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AutoComplete,
  Button,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Typography,
  message,
} from '@/shared/antd-imports';
import { CheckCircleFilled, CopyOutlined } from '@ant-design/icons';
import {
  githubApiService,
  IGithubCreatedBranch,
  IGithubTaskRepository,
} from '@/api/github/github.api.service';
import logger from '@/utils/errorLogger';

interface CreateBranchModalProps {
  open: boolean;
  taskId: string;
  taskKey: string;
  taskName: string;
  repositories: IGithubTaskRepository[];
  onClose: () => void;
  onCreated: () => void;
}

interface CreateBranchFormValues {
  repositoryId: string;
  prefix: string;
  name: string;
  baseBranch: string;
}

const BRANCH_PREFIXES = ['feature/', 'bugfix/', 'hotfix/', 'chore/'];
const MAX_SLUG_LENGTH = 40;
const BRANCH_NAME_PATTERN = /^[A-Za-z0-9._/-]{1,200}$/;

/** `Add OAuth login!` -> `add-oauth-login` */
export const slugifyForBranch = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');

const getStatusCode = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } })?.response?.status;

/** Creates a branch on GitHub from an issue, named after the issue key. */
export const CreateBranchModal = ({
  open,
  taskId,
  taskKey,
  taskName,
  repositories,
  onClose,
  onCreated,
}: CreateBranchModalProps) => {
  const { t } = useTranslation('github-integration');
  const [form] = Form.useForm<CreateBranchFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [created, setCreated] = useState<IGithubCreatedBranch | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [branchesFailed, setBranchesFailed] = useState(false);

  const defaultName = useMemo(
    () => [taskKey, slugifyForBranch(taskName)].filter(Boolean).join('-'),
    [taskKey, taskName]
  );

  const initialValues = useMemo<CreateBranchFormValues>(
    () => ({
      repositoryId: repositories[0]?.repository_id ?? '',
      prefix: BRANCH_PREFIXES[0],
      name: defaultName,
      baseBranch: repositories[0]?.default_base_branch ?? '',
    }),
    [repositories, defaultName]
  );

  useEffect(() => {
    if (!open) return;
    setCreated(null);
    setErrorText(null);
  }, [open]);

  // Load real branches for the selected repository; also repairs an empty base branch.
  const loadBranches = useCallback(
    async (repositoryId: string) => {
      if (!repositoryId) return;
      setIsLoadingBranches(true);
      setBranchesFailed(false);
      try {
        const response = await githubApiService.getRepositoryBranches(taskId, repositoryId);
        if (!response.done) throw new Error('branch lookup failed');
        setBranches(response.body.branches);
        if (!form.getFieldValue('baseBranch')) {
          const configured = repositories.find(
            repo => repo.repository_id === repositoryId
          )?.default_base_branch;
          form.setFieldValue('baseBranch', configured || response.body.default_branch);
        }
      } catch (error) {
        logger.error('Failed to load GitHub branches', error);
        setBranches([]);
        setBranchesFailed(true);
      } finally {
        setIsLoadingBranches(false);
      }
    },
    [taskId, repositories, form]
  );

  useEffect(() => {
    if (open && !created) void loadBranches(initialValues.repositoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues.repositoryId]);

  const handleRepositoryChange = (repositoryId: string) => {
    const repository = repositories.find(item => item.repository_id === repositoryId);
    form.setFieldValue('baseBranch', repository?.default_base_branch ?? '');
    void loadBranches(repositoryId);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const branchName = `${values.prefix}${values.name.trim()}`;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const response = await githubApiService.createBranch(taskId, {
        repository_id: values.repositoryId,
        name: branchName,
        base_branch: values.baseBranch.trim(),
      });
      if (response.done) {
        setCreated(response.body);
        onCreated();
      } else {
        setErrorText(
          t('development.createBranch.errors.generic', {
            defaultValue: 'Could not create the branch.',
          })
        );
      }
    } catch (error) {
      logger.error('Failed to create GitHub branch', error);
      const status = getStatusCode(error);
      setErrorText(
        status === 409
          ? t('development.createBranch.errors.exists', {
              defaultValue: 'A branch with this name already exists.',
            })
          : status === 404
            ? t('development.createBranch.errors.baseMissing', {
                defaultValue: 'The base branch was not found in this repository.',
              })
            : status === 403
              ? t('development.createBranch.errors.permission', {
                  defaultValue:
                    'The GitHub App is not allowed to create branches. Ask an admin to grant it Contents write access.',
                })
              : t('development.createBranch.errors.generic', {
                  defaultValue: 'Could not create the branch.',
                })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.checkout_command);
      messageApi.success(
        t('development.createBranch.copied', { defaultValue: 'Copied to clipboard.' })
      );
    } catch (error) {
      logger.error('Failed to copy checkout command', error);
    }
  };

  const title = t('development.createBranch.title', { defaultValue: 'Create branch' });

  return (
    <>
      {contextHolder}
      <Modal
        open={open}
        title={title}
        onCancel={onClose}
        destroyOnHidden
        footer={
          created ? (
            <Button type="primary" onClick={onClose}>
              {t('development.createBranch.done', { defaultValue: 'Done' })}
            </Button>
          ) : (
            <Space>
              <Button onClick={onClose}>{t('actions.cancel', { defaultValue: 'Cancel' })}</Button>
              <Button type="primary" loading={isSubmitting} onClick={() => void handleSubmit()}>
                {title}
              </Button>
            </Space>
          )
        }
      >
        {created ? (
          <Flex vertical gap={12}>
            <Flex align="center" gap={8}>
              <CheckCircleFilled
                style={{ color: 'var(--ant-color-success, #52c41a)' }}
                aria-hidden
              />
              <Typography.Text strong>
                {t('development.createBranch.created', { defaultValue: 'Branch created.' })}
              </Typography.Text>
            </Flex>
            <Typography.Link href={created.html_url} target="_blank" rel="noopener noreferrer">
              {created.name}
            </Typography.Link>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('development.createBranch.checkoutHint', {
                defaultValue: 'Run this to start working on it locally:',
              })}
            </Typography.Text>
            <Flex gap={8} align="center">
              <Typography.Text code style={{ flex: 1, wordBreak: 'break-all' }}>
                {created.checkout_command}
              </Typography.Text>
              <Button
                icon={<CopyOutlined />}
                onClick={() => void handleCopy()}
                aria-label={t('development.createBranch.copy', { defaultValue: 'Copy command' })}
              />
            </Flex>
          </Flex>
        ) : (
          <Form form={form} layout="vertical" requiredMark={false} initialValues={initialValues}>
            {errorText && (
              <Alert type="error" showIcon message={errorText} style={{ marginBottom: 16 }} />
            )}
            <Form.Item
              name="repositoryId"
              label={t('development.createBranch.repository', { defaultValue: 'Repository' })}
              rules={[{ required: true }]}
            >
              <Select
                onChange={handleRepositoryChange}
                options={repositories.map(repo => ({
                  value: repo.repository_id,
                  label: repo.full_name,
                }))}
              />
            </Form.Item>
            <Form.Item
              label={t('development.createBranch.name', { defaultValue: 'Branch name' })}
              required
              style={{ marginBottom: 0 }}
            >
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="prefix" noStyle>
                  <Select
                    style={{ width: 130 }}
                    options={BRANCH_PREFIXES.map(prefix => ({ value: prefix, label: prefix }))}
                    aria-label={t('development.createBranch.type', { defaultValue: 'Type' })}
                  />
                </Form.Item>
                <Form.Item
                  name="name"
                  noStyle
                  rules={[
                    {
                      required: true,
                      pattern: BRANCH_NAME_PATTERN,
                      message: t('development.createBranch.invalidName', {
                        defaultValue: 'Use letters, numbers, dots, dashes, underscores or slashes.',
                      }),
                    },
                  ]}
                >
                  <Input
                    aria-label={t('development.createBranch.name', { defaultValue: 'Branch name' })}
                  />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
            <Form.Item
              name="baseBranch"
              label={t('development.createBranch.baseBranch', { defaultValue: 'Base branch' })}
              rules={[{ required: true, pattern: BRANCH_NAME_PATTERN }]}
              style={{ marginTop: 16 }}
              extra={
                branchesFailed
                  ? t('development.createBranch.branchesFailed', {
                      defaultValue: 'Could not load branches. You can still type the base branch.',
                    })
                  : undefined
              }
            >
              <AutoComplete
                options={branches.map(branch => ({ value: branch }))}
                filterOption={(input, option) =>
                  (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                }
                placeholder={
                  isLoadingBranches
                    ? t('development.createBranch.loadingBranches', {
                        defaultValue: 'Loading branches…',
                      })
                    : t('development.createBranch.selectBranch', {
                        defaultValue: 'Select or type a branch',
                      })
                }
                aria-label={t('development.createBranch.baseBranch', {
                  defaultValue: 'Base branch',
                })}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </>
  );
};

export default CreateBranchModal;
