import React, { useMemo, useState } from 'react';
import { Select, Input, Button, Flex, message } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  useGetServiceOptionValuesQuery,
  useCreateServiceOptionValueMutation,
} from '@/api/client-portal/client-portal-api';

const ADD_CUSTOM_OPTION = '__add_custom__';

interface EditableSelectProps {
  kind: 'category' | 'billing_type';
  value: string;
  builtInOptions: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  size?: 'small' | 'middle' | 'large';
}

/**
 * A Select whose option list is a fixed built-in list merged with the org's own saved values
 * (fetched by `kind`), plus a trailing "+ Add custom…" entry that swaps the control into an
 * inline text input. Confirming persists the new value via the service-option-values API so it's
 * available for the rest of the org, not just this session.
 */
const EditableSelect: React.FC<EditableSelectProps> = ({
  kind,
  value,
  builtInOptions,
  onChange,
  placeholder,
  size = 'middle',
}) => {
  const { t } = useTranslation('client-portal-services');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const { data } = useGetServiceOptionValuesQuery(kind);
  const [createOption, { isLoading: isSaving }] = useCreateServiceOptionValueMutation();

  const customValues = useMemo(() => (data?.body ?? []).map(option => option.value), [data]);

  const options = useMemo(() => {
    const merged = [...builtInOptions, ...customValues];
    // A legacy free-text value that predates this picklist must still show up as selected.
    if (value && !merged.some(option => option.toLowerCase() === value.toLowerCase())) {
      merged.push(value);
    }
    const seen = new Set<string>();
    return merged.filter(option => {
      const key = option.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [builtInOptions, customValues, value]);

  const handleSelect = (selected: string) => {
    if (selected === ADD_CUSTOM_OPTION) {
      setDraft('');
      setAdding(true);
      return;
    }
    onChange(selected);
  };

  const confirmAdd = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }

    try {
      await createOption({ kind, value: trimmed }).unwrap();
      onChange(trimmed);
      setAdding(false);
    } catch (err) {
      const errorMessage = (err as { data?: { message?: string } })?.data?.message;
      message.error(
        errorMessage || t('addCustomValueError', { defaultValue: 'Failed to add value' })
      );
    }
  };

  if (adding) {
    return (
      <Flex gap={6}>
        <Input
          autoFocus
          size={size}
          value={draft}
          placeholder={t('addCustomValuePlaceholder', { defaultValue: 'Type a new value…' })}
          onChange={event => setDraft(event.target.value)}
          onPressEnter={confirmAdd}
          onKeyDown={event => {
            if (event.key === 'Escape') setAdding(false);
          }}
        />
        <Button type="primary" size={size} loading={isSaving} onClick={confirmAdd}>
          {t('addButton', { defaultValue: 'Add' })}
        </Button>
        <Button size={size} onClick={() => setAdding(false)}>
          {t('cancelButton', { defaultValue: 'Cancel' })}
        </Button>
      </Flex>
    );
  }

  return (
    <Select
      style={{ width: '100%' }}
      size={size}
      value={value || undefined}
      placeholder={placeholder}
      onChange={handleSelect}
      options={[
        ...options.map(option => ({ value: option, label: option })),
        { value: ADD_CUSTOM_OPTION, label: t('addCustomOption', { defaultValue: '+ Add custom…' }) },
      ]}
    />
  );
};

export default EditableSelect;
