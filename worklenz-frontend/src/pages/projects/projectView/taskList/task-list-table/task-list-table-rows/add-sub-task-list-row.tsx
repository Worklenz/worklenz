import { Input, Button } from '@/shared/antd-imports';
import React, { useRef, useEffect, useState } from 'react';
import { useAppSelector } from '../../../../../../hooks/useAppSelector';
import { colors } from '../../../../../../styles/colors';
import { useTranslation } from 'react-i18next';

interface AddSubTaskListRowProps {
  visibleColumns: { key: string; label: string; width: number }[];
  taskColumnKey: string;
  onAdd: (name: string) => void;
  onCancel: () => void;
  parentTaskId: string;
}

const AddSubTaskListRow: React.FC<AddSubTaskListRowProps> = ({
  visibleColumns,
  taskColumnKey,
  onAdd,
  onCancel,
}) => {
  const [subtaskName, setSubtaskName] = useState('');
  const inputRef = useRef<any>(null);
  const { t } = useTranslation('task-list-table');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const customBorderColor = themeMode === 'dark' ? ' border-[#303030]' : '';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && subtaskName.trim()) {
      onAdd(subtaskName.trim());
      setSubtaskName('');
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <tr className={`add-subtask-row${customBorderColor}`}>
      {visibleColumns.map(col => (
        <td key={col.key} style={{ padding: 0, background: 'inherit' }}>
          {col.key === taskColumnKey ? (
            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
              <Input
                ref={inputRef}
                value={subtaskName}
                onChange={e => setSubtaskName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={onCancel}
                placeholder={t('enterSubtaskName')}
                style={{ width: '100%' }}
                autoFocus
              />
              <Button
                size="small"
                type="primary"
                style={{ marginLeft: 8 }}
                disabled={!subtaskName.trim()}
                onClick={() => {
                  if (subtaskName.trim()) {
                    onAdd(subtaskName.trim());
                    setSubtaskName('');
                  }
                }}
              >
                {t('add')}
              </Button>
              <Button size="small" style={{ marginLeft: 4 }} onClick={onCancel}>
                {t('cancel')}
              </Button>
            </div>
          ) : null}
        </td>
      ))}
    </tr>
  );
};

export default AddSubTaskListRow;
