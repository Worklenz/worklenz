import React, { useEffect, useRef } from 'react';
import { Input } from '@/shared/antd-imports';
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { setTeamMembers } from '@/features/account-setup/account-setup.slice';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { validateEmail } from '@/utils/validateEmail';
import { sanitizeInput } from '@/utils/sanitizeInput';

interface MembersStepProps {
  isDarkMode: boolean;
  styles: any;
  token?: any;
}

const MembersStep: React.FC<MembersStepProps> = ({ token }) => {
  const { t } = useTranslation('account-setup');
  const { teamMembers } = useSelector((state: RootState) => state.accountSetupReducer);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const dispatch = useDispatch();

  const addEmail = () => {
    if (teamMembers.length >= 5) return;
    const newId = teamMembers.length > 0 ? Math.max(...teamMembers.map(t => t.id)) + 1 : 0;
    dispatch(setTeamMembers([...teamMembers, { id: newId, value: '' }]));
    setTimeout(() => inputRefs.current[teamMembers.length]?.focus(), 100);
  };

  const removeEmail = (id: number) => {
    if (teamMembers.length > 1)
      dispatch(setTeamMembers(teamMembers.filter(teamMember => teamMember.id !== id)));
  };

  const updateEmail = (id: number, value: string) => {
    const sanitizedValue = sanitizeInput(value);
    dispatch(
      setTeamMembers(
        teamMembers.map(teamMember =>
          teamMember.id === id ? { ...teamMember, value: sanitizedValue } : teamMember
        )
      )
    );
  };

  const handleKeyDown = (index: number, value: string) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    if (index < teamMembers.length - 1) {
      inputRefs.current[index + 1]?.focus();
      return;
    }

    if (validateEmail(value.trim())) addEmail();
  };

  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 200);
  }, []);

  const statusIcon = (value: string) => {
    if (!value.trim()) return null;
    return validateEmail(value) ? (
      <CheckCircleOutlined style={{ color: token?.colorSuccess }} />
    ) : (
      <ExclamationCircleOutlined style={{ color: token?.colorError }} />
    );
  };

  return (
    <div className="w-full">
      <h2 className="wiz-h2" style={{ color: token?.colorText }}>
        {t('membersStepTitle')}
      </h2>
      <p className="wiz-sub" style={{ color: token?.colorTextSecondary }}>
        {t('membersStepSubheading')}
      </p>

      <p
        className="wiz-info-text"
        style={{ color: token?.colorTextTertiary }}
      >
        {t('membersStepInfoBanner')}
      </p>

      <div>
        {teamMembers.map((member, index) => (
          <div key={member.id} className="wiz-email-row">
            <Input
              size="large"
              placeholder={t('teammateEmailPlaceholder')}
              value={member.value}
              onChange={e => updateEmail(member.id, e.target.value)}
              onKeyDown={handleKeyDown(index, member.value)}
              ref={el => {
                inputRefs.current[index] = el as unknown as HTMLInputElement;
              }}
            />
            <span className="wiz-row-status">{statusIcon(member.value)}</span>
            {teamMembers.length > 1 ? (
              <button
                type="button"
                className="wiz-row-remove"
                onClick={() => removeEmail(member.id)}
                aria-label={t('removeMember', 'Remove')}
                style={{ color: token?.colorTextTertiary }}
              >
                ✕
              </button>
            ) : (
              <span style={{ width: 24 }} />
            )}
          </div>
        ))}
      </div>

      {teamMembers.length < 5 && (
        <button
          type="button"
          className="wiz-add-row-btn"
          onClick={addEmail}
          style={{ color: token?.colorPrimary }}
        >
          {t('addAnotherLink')}
        </button>
      )}
    </div>
  );
};

export default MembersStep;
