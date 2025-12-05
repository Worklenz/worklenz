import {
    Button,
    Flex,
    Form,
    message,
    Modal,
    Select,
    Typography,
} from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleProjectMemberDrawer } from '@/features/projects/singleProject/members/projectMembersSlice';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { CopyOutlined, CheckOutlined, ShareAltOutlined } from '@ant-design/icons';
import { ROLE_NAMES } from '@/types/roles/role.types';
import { projectMembersApiService } from '@/api/project-members/project-members.api.service';
import { themeWiseColor } from '@/utils/themeWiseColor';

interface FormValues {
    emails: string[];
    access: 'member' | 'team-lead' | 'admin';
}

interface InviteProjectMembersProps {
    projectId: string;
    projectName: string;
}

const InviteProjectMembers = ({ projectId, projectName }: InviteProjectMembersProps) => {
    // Email invitation states
    const [loading, setLoading] = useState(false);

    // Link invitation states
    const [linkLoading, setLinkLoading] = useState(false);
    const [invitationLink, setInvitationLink] = useState<string>('');
    const [linkExpiry, setLinkExpiry] = useState<string>('');
    const [hasActiveLink, setHasActiveLink] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    const [form] = Form.useForm<FormValues>();

    const { t } = useTranslation('settings/team-members');
    const isDrawerOpen = useAppSelector(state => state.projectMemberReducer.isDrawerOpen);
    const themeMode = useAppSelector(state => state.themeReducer.mode);
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (isDrawerOpen && projectId) {
            checkExistingInvitationLink();
        }
    }, [isDrawerOpen, projectId]);

    const checkExistingInvitationLink = async () => {
        try {
            const res = await projectMembersApiService.getInvitationLinkStatus(projectId);
            if (res.done && res.body.has_active_link) {
                setHasActiveLink(true);
                setInvitationLink(res.body.invitation_url || '');
                setLinkExpiry(res.body.expires_at || '');
            } else {
                setHasActiveLink(false);
                setInvitationLink('');
                setLinkExpiry('');
            }
        } catch (error) {
            console.error('Error checking project invitation link status:', error);
        }
    };

    const handleFormSubmit = async (values: FormValues) => {
        try {
            setLoading(true);

            // Get emails from form values
            const emailList = values.emails || [];

            if (emailList.length === 0) {
                message.error(t('Please enter at least one email address'));
                setLoading(false);
                return;
            }

            // Send invitations for each email - wrap each call to catch individual errors
            const invitePromises = emailList.map(async (email) => {
                try {
                    const body = {
                        email: email.trim(),
                        project_id: projectId,
                        access_level: values.access.toUpperCase(),
                        role_name:
                            values.access === 'team-lead'
                                ? ROLE_NAMES.TEAM_LEAD
                                : values.access === 'admin'
                                    ? ROLE_NAMES.ADMIN
                                    : ROLE_NAMES.MEMBER,
                        is_admin: values.access === 'admin',
                    };
                    const result = await projectMembersApiService.inviteByEmail(body);
                    return { email, success: result.done, error: result.message };
                } catch (error: any) {
                    return { email, success: false, error: error.message || 'Unknown error' };
                }
            });

            const results = await Promise.all(invitePromises);
            const successResults = results.filter(r => r.success);
            const failedResults = results.filter(r => !r.success);

            const successCount = successResults.length;
            const failCount = failedResults.length;

            // Show detailed feedback
            if (successCount > 0 && failCount > 0) {
                const failedEmails = failedResults.map(r => r.email).join(', ');
                message.warning(`${successCount} invited successfully. Failed: ${failedEmails}`);
                form.resetFields();
                dispatch(toggleProjectMemberDrawer());
            } else if (successCount > 0) {
                message.success(`${successCount} project member(s) invited successfully`);
                form.resetFields();
                dispatch(toggleProjectMemberDrawer());
            } else {
                const failedEmails = failedResults.map(r => r.email).join(', ');
                message.error(`Failed to invite: ${failedEmails}`);
            }
        } catch (error) {
            console.error('Error inviting project members:', error);
            message.error(t('Failed to invite project members'));
        } finally {
            setLoading(false);
        }
    };

    const handleCreateInvitationLink = async () => {
        try {
            setLinkLoading(true);
            const linkData = {
                project_id: projectId,
                access_level: 'MEMBER',
                role_name: ROLE_NAMES.MEMBER,
                is_admin: false,
                max_usage: null // Unlimited usage
            };

            const res = await projectMembersApiService.generateInvitationLink(linkData);
            if (res.done) {
                setInvitationLink(res.body.invitation_url);
                setLinkExpiry(res.body.expires_at);
                setHasActiveLink(true);
                message.success(t('Project invitation link created successfully'));
            }
        } catch (error) {
            message.error(t('Failed to create project invitation link'));
        } finally {
            setLinkLoading(false);
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(invitationLink);
            setLinkCopied(true);
            message.success(t('Project invitation link copied to clipboard'));
            setTimeout(() => setLinkCopied(false), 2000);
        } catch (error) {
            message.error(t('Failed to copy link'));
        }
    };

    const handleClose = () => {
        form.resetFields();
        setLinkCopied(false);
        dispatch(toggleProjectMemberDrawer());
    };

    const formatExpiryDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffTime = date.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 0) {
                return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
            } else {
                return 'Expired';
            }
        } catch {
            return 'Unknown';
        }
    };

    return (
        <Modal
            title={
                <Typography.Text strong style={{ fontSize: 16 }}>
                    Share "{projectName}"
                </Typography.Text>
            }
            open={isDrawerOpen}
            onCancel={handleClose}
            destroyOnClose={false}
            width={500}
            loading={loading}
            footer={
                <Flex justify="flex-end" align="center">
                    <Button
                        loading={linkLoading}
                        onClick={hasActiveLink ? handleCopyLink : handleCreateInvitationLink}
                        icon={hasActiveLink ? (linkCopied ? <CheckOutlined /> : <CopyOutlined />) : <ShareAltOutlined />}
                    >
                        {hasActiveLink
                            ? (linkCopied ? t('Copied!') : t('Copy project link'))
                            : t('Copy project link')
                        }
                    </Button>
                </Flex>
            }
        >
            <Flex vertical gap={2}>
                {/* Email Invitation Section */}
                <Form
                    form={form}
                    onFinish={handleFormSubmit}
                    layout="vertical"
                    initialValues={{ access: 'member' }}
                >
                    <Flex gap={16} align="flex-start">
                        <Form.Item
                            name="emails"
                            label={t('Invite with email')}
                            style={{ flex: 1, marginBottom: 16 }}
                            rules={[
                                {
                                    validator: (_, value) => {
                                        // Check if value exists and has items
                                        if (!value || !Array.isArray(value) || value.length === 0) {
                                            return Promise.reject(new Error(t('Please enter at least one email address')));
                                        }

                                        // Validate each email format
                                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                        const invalidEmails = value.filter((email: string) => !emailRegex.test(email.trim()));

                                        if (invalidEmails.length > 0) {
                                            return Promise.reject(new Error(t('Please enter valid email addresses')));
                                        }

                                        return Promise.resolve();
                                    },
                                },
                            ]}
                        >
                            <Select
                                mode="tags"
                                style={{ width: '100%' }}
                                placeholder={t('Add people or Email')}
                                notFoundContent={
                                    <Typography.Text type="secondary">{t('Type email and press Enter')}</Typography.Text>
                                }
                                tokenSeparators={[',', ' ', ';']}
                            />
                        </Form.Item>
                        <Button htmlType="submit" type="primary" loading={loading} style={{ marginTop: 30 }}>
                            {t('Invite')}
                        </Button>
                    </Flex>

                    <Form.Item label={t('Access level')} name="access">
                        <Select
                            options={[
                                { value: 'member', label: t('memberText') },
                                { value: 'team-lead', label: 'Team Lead' },
                                { value: 'admin', label: t('adminText') },
                            ]}
                        />
                    </Form.Item>
                </Form>

                {/* Link Status Section */}
                {hasActiveLink && (
                    <div style={{
                        padding: '4px',
                        backgroundColor: themeWiseColor('#f6ffed', '#1f2937', themeMode),
                        border: `1px solid ${themeWiseColor('#b7eb8f', '#374151', themeMode)}`,
                        borderRadius: '6px'
                    }}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            Active invitation link expires in {formatExpiryDate(linkExpiry)}
                        </Typography.Text>
                    </div>
                )}
            </Flex>
        </Modal>
    );
};

export default InviteProjectMembers;