import React, { useMemo, useState } from 'react';
import { Alert, Button, Flex, Input, Modal, Tooltip, Typography, CopyOutlined, SendOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useMessage } from '@/hooks/useMessage';
import { useCreateInviteLinkMutation } from '@/store/api-v2';
import { errorMessage } from '@/components/v2/queryErrors';

interface InviteResult {
  link: string | null;
  expires_in_days: number;
  /** Addresses that were emailed an invitation. */
  emailed: string[];
  /** Addresses that were invited but whose email could not be sent: share the link by hand. */
  emailFailed: Array<{ email: string; link: string | null }>;
  /** Addresses that could not be invited at all, with the reason. */
  rejected: Array<{ email: string; reason: string }>;
  /** The single-address link view (copy invite link, or an email that did not send). */
  single: boolean;
}

interface InviteLinkModalProps {
  open: boolean;
  onClose: () => void;
  /** Opens straight on the share step for someone already invited (copy invite link from the members table). */
  existing?: { link: string; expires_in_days: number } | null;
}

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

/** Splits what was typed or pasted on commas, semicolons, spaces and new lines; drops repeats. */
const parseEmails = (raw: string): string[] =>
  Array.from(new Set(raw.split(/[\s,;]+/).map(part => part.trim().toLowerCase()).filter(Boolean)));

export const InviteLinkModal = ({ open, onClose, existing = null }: InviteLinkModalProps) => {
  const { t } = useTranslation();
  const message = useMessage();
  const [createInvite, { isLoading }] = useCreateInviteLinkMutation();
  const [text, setText] = useState('');
  const [pending, setPending] = useState<'email' | 'link' | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setText('');
      setPending(null);
      setResult(
        existing ? { link: existing.link, expires_in_days: existing.expires_in_days, emailed: [], emailFailed: [], rejected: [], single: true } : null
      );
      setError(null);
    }
  }, [open, existing]);

  const emails = useMemo(() => parseEmails(text), [text]);
  const isMultiple = emails.length > 1;
  const hasEmail = emails.length > 0;

  const copyText = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      void message.success(t('account.org.copied', { defaultValue: 'Link copied.' }));
    } catch {
      void message.info(t('account.org.copyManually', { defaultValue: 'Copy the link from the box.' }));
    }
  };

  const submit = async (sendEmail: boolean) => {
    setError(null);
    const invalid = emails.filter(address => !EMAIL_PATTERN.test(address));
    if (invalid.length > 0) {
      setError(
        t('account.org.invalidEmails', {
          emails: invalid.join(', '),
          defaultValue: 'These are not valid email addresses: {{emails}}',
        })
      );
      return;
    }

    setPending(sendEmail ? 'email' : 'link');
    const next: InviteResult = { link: null, expires_in_days: 7, emailed: [], emailFailed: [], rejected: [], single: emails.length === 1 };
    // One at a time, so a bad address (already has access, say) never blocks the others.
    for (const address of emails) {
      try {
        const created = await createInvite({ email: address, send_email: sendEmail }).unwrap();
        next.expires_in_days = created.expires_in_days;
        if (!sendEmail) next.link = created.link;
        else if (created.emailed) next.emailed.push(created.email);
        else next.emailFailed.push({ email: created.email, link: created.link });
      } catch (err) {
        next.rejected.push({
          email: address,
          reason: errorMessage(err) ?? t('account.org.inviteFailed', { defaultValue: 'We could not create the invite link.' }),
        });
      }
    }
    setPending(null);

    const nothingWorked = next.emailed.length === 0 && next.emailFailed.length === 0 && next.link === null;
    if (nothingWorked && next.single) {
      setError(next.rejected[0]?.reason ?? null);
      return;
    }
    setResult(next);
    if (!sendEmail && next.link) void copyText(next.link);
  };

  const failedLink = result?.single ? result.emailFailed[0]?.link ?? null : null;
  const shownLink = result?.single ? result.link ?? failedLink : null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={560}
      title={t('account.org.inviteTitle', { defaultValue: 'Invite colleagues' })}
      footer={
        // One row with the two invite choices; the X closes the dialog. It only wraps on a phone.
        <Flex gap={8} justify="flex-end" wrap="wrap">
          {result ? (
            <Button type="primary" onClick={onClose}>{t('common.done', { defaultValue: 'Done' })}</Button>
          ) : (
            <>
              <Tooltip
                title={
                  isMultiple
                    ? t('account.org.copyLinkSingleOnly', { defaultValue: 'Invite links are made for one person at a time. Use Send email invite for several.' })
                    : undefined
                }
              >
                <Button
                  icon={<CopyOutlined />}
                  loading={isLoading && pending === 'link'}
                  disabled={!hasEmail || isMultiple || isLoading}
                  onClick={() => void submit(false)}
                >
                  {t('account.org.copyInviteLink', { defaultValue: 'Copy invite link' })}
                </Button>
              </Tooltip>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={isLoading && pending === 'email'}
                disabled={!hasEmail || isLoading}
                onClick={() => void submit(true)}
              >
                {isMultiple
                  ? t('account.org.sendInvites', { count: emails.length, defaultValue: 'Send {{count}} email invites' })
                  : t('account.org.sendInvite', { defaultValue: 'Send email invite' })}
              </Button>
            </>
          )}
        </Flex>
      }
    >
      {result && !result.single ? (
        <Flex vertical gap={12}>
          {result.emailed.length > 0 && (
            <Alert
              type="success"
              showIcon
              message={t('account.org.invitesSent', {
                count: result.emailed.length,
                days: result.expires_in_days,
                defaultValue_one: 'We emailed an invitation to {{count}} person. The link works for {{days}} days.',
                defaultValue_other: 'We emailed invitations to {{count}} people. The links work for {{days}} days.',
              })}
              description={result.emailed.join(', ')}
            />
          )}
          {result.emailFailed.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={t('account.org.emailsNotSent', { defaultValue: "We invited these people but couldn't send the email. Resend it from the Members list." })}
              description={result.emailFailed.map(item => item.email).join(', ')}
            />
          )}
          {result.rejected.length > 0 && (
            <Alert
              type="error"
              showIcon
              message={t('account.org.invitesRejected', { defaultValue: "These addresses weren't invited:" })}
              description={
                <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                  {result.rejected.map(item => (
                    <li key={item.email}>{item.email}: {item.reason}</li>
                  ))}
                </ul>
              }
            />
          )}
        </Flex>
      ) : result && shownLink === null ? (
        <Typography.Paragraph>
          {result.emailed.length > 0
            ? t('account.org.inviteSentTo', {
                email: result.emailed[0],
                days: result.expires_in_days,
                defaultValue: 'We emailed an invitation to {{email}}. The link in it works for {{days}} days.',
              })
            : ''}
        </Typography.Paragraph>
      ) : result ? (
        <>
          {failedLink && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={t('account.org.emailNotSent', { defaultValue: 'We could not send the email. Share this link with your colleague instead.' })}
            />
          )}
          <Typography.Paragraph>
            {t('account.org.linkReady', {
              days: result.expires_in_days,
              defaultValue: 'Share this link with your colleague. It works for {{days}} days. They confirm their email with a one-time code and join as a Client Viewer until your project contact assigns projects.',
            })}
          </Typography.Paragraph>
          <Flex gap={8}>
            <Input readOnly value={shownLink ?? ''} aria-label={t('account.org.inviteLink', { defaultValue: 'Invite link' })} />
            <Button
              icon={<CopyOutlined />}
              onClick={() => shownLink && void copyText(shownLink)}
              aria-label={t('account.org.copy', { defaultValue: 'Copy link' })}
            />
          </Flex>
        </>
      ) : (
        <>
          <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
            {t('account.org.emailAddresses', { defaultValue: 'Email addresses' })}
          </Typography.Text>
          <Input.TextArea
            value={text}
            autoSize={{ minRows: 2, maxRows: 6 }}
            placeholder={t('account.org.emailsPlaceholder', { defaultValue: 'colleague@company.com, another@company.com' })}
            aria-label={t('account.org.emailAddresses', { defaultValue: 'Email addresses' })}
            onChange={event => setText(event.target.value)}
          />
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 6 }}>
            {t('account.org.emailsHint', {
              defaultValue: 'Add one address, or several separated by commas, spaces or new lines. Several people can only be invited by email.',
            })}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 6 }}>
            {t('account.org.inviteHint', {
              defaultValue:
                'New colleagues start as a Client Viewer with no projects. Your project contact assigns their projects and role. They verify this email address with a one-time code when they activate.',
            })}
          </Typography.Text>
          {error && <Alert type="error" showIcon style={{ marginTop: 10 }} message={error} />}
        </>
      )}
    </Modal>
  );
};
