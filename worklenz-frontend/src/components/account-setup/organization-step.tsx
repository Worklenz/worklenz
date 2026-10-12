import React, { useEffect, useRef } from 'react';
import { Input, InputRef } from '@/shared/antd-imports';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { setOrganizationName } from '@/features/account-setup/account-setup.slice';
import { RootState } from '@/app/store';
import { sanitizeInput } from '@/utils/sanitizeInput';

interface Props {
  onEnter: () => void;
  organizationNamePlaceholder: string;
  organizationNameInitialValue?: string;
  prefilledEmail?: string;
  isDarkMode: boolean;
  token?: any;
}

export const OrganizationStep: React.FC<Props> = ({
  onEnter,
  organizationNamePlaceholder,
  organizationNameInitialValue,
  prefilledEmail,
  token,
}) => {
  const { t } = useTranslation('account-setup');
  const dispatch = useDispatch();
  const { organizationName } = useSelector((state: RootState) => state.accountSetupReducer);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (!organizationName && organizationNameInitialValue) {
      dispatch(setOrganizationName(organizationNameInitialValue));
    }
    setTimeout(() => inputRef.current?.focus(), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPressEnter = () => {
    if (organizationName.trim().length < 2) return;
    onEnter();
  };

  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setOrganizationName(sanitizeInput(e.target.value)));
  };

  const isValid = organizationName.trim().length >= 2;
  const showPrefilledNote = Boolean(organizationNameInitialValue && prefilledEmail);

  return (
    <div className="w-full">
      <h2 className="wiz-h2" style={{ color: token?.colorText }}>
        {t('organizationStepHeadline')}
      </h2>
      <p className="wiz-sub" style={{ color: token?.colorTextSecondary }}>
        {t('organizationStepSubheading')}
      </p>

      <div className="wiz-field-wrap">
        <label className="wiz-field-label" style={{ color: token?.colorTextSecondary }}>
          {t('organizationStepLabel')}
        </label>
        <div className="wiz-input-row">
          <Input
            size="large"
            placeholder={organizationNamePlaceholder || t('organizationStepPlaceholder')}
            value={organizationName}
            onChange={handleOrgNameChange}
            onPressEnter={onPressEnter}
            ref={inputRef}
            maxLength={50}
          />
          <span
            className="wiz-check-ok"
            style={{ visibility: isValid ? 'visible' : 'hidden', color: token?.colorSuccess }}
          >
            ✓
          </span>
        </div>
        <div className="wiz-char-count" style={{ color: token?.colorTextTertiary }}>
          {organizationName.length}/50
        </div>
        {showPrefilledNote && (
          <div className="wiz-smart-note" style={{ color: token?.colorTextTertiary }}>
            {t('organizationStepPrefilledNote', { email: prefilledEmail })}
          </div>
        )}
      </div>
    </div>
  );
};
