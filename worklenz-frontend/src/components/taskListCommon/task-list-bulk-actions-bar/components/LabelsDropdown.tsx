import { Badge, Button, Card, Checkbox, Empty, Flex, Input, List, Typography } from '@/shared/antd-imports';
import { CheckboxChangeEvent } from 'antd/es/checkbox';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';
import { InputRef } from 'antd/es/input';
import { useEffect, useMemo } from 'react'; // Add useMemo for filtering

interface LabelsDropdownProps {
  labelsList: ITaskLabel[];
  themeMode: string;
  createLabelText: string;
  selectedLabels: ITaskLabel[];
  labelsInputRef: React.RefObject<InputRef>;
  onLabelChange: (e: CheckboxChangeEvent, label: ITaskLabel) => void;
  onCreateLabelTextChange: (value: string) => void;
  onApply: () => void;
  t: (key: string) => string;
  loading: boolean;
}

const LabelsDropdown = ({
  labelsList,
  themeMode,
  createLabelText,
  selectedLabels,
  labelsInputRef,
  onLabelChange,
  onCreateLabelTextChange,
  onApply,
  loading,
  t,
}: LabelsDropdownProps) => {
  useEffect(() => {
    if (labelsInputRef.current) {
      labelsInputRef.current.focus();
    }
  }, []);

  // Filter labels based on search input
  const filteredLabels = useMemo(() => {
    if (!createLabelText.trim()) {
      return labelsList;
    }
    return labelsList.filter(label =>
      label.name?.toLowerCase().includes(createLabelText.toLowerCase())
    );
  }, [labelsList, createLabelText]);

  // Check if the search text matches any existing label exactly
  const exactMatch = useMemo(() => {
    return labelsList.some(label => label.name?.toLowerCase() === createLabelText.toLowerCase());
  }, [labelsList, createLabelText]);

  const isOnApply = () => {
    if (!createLabelText.trim() && selectedLabels.length === 0) return;
    onApply();
  };
  return (
    <Card className="custom-card" styles={{ body: { padding: 8 } }}>
      <Flex vertical>
        {/* Show filtered labels list */}
        <List
          style={{
            padding: 0,
            overflow: 'auto',
            maxHeight: filteredLabels.length > 10 ? '200px' : 'auto',
            maxWidth: 250,
          }}
        >
          {filteredLabels.length > 0 ? (
            filteredLabels.map(label => (
              <List.Item
                className={themeMode === 'dark' ? 'custom-list-item dark' : 'custom-list-item'}
                key={label.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'flex-start',
                  padding: '4px 8px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Checkbox
                  id={label.id}
                  checked={selectedLabels.some(l => l.id === label.id)}
                  onChange={e => onLabelChange(e, label)}
                >
                  <Badge color={label.color_code} text={label.name} />
                </Checkbox>
              </List.Item>
            ))
          ) : createLabelText.trim() ? (
            <List.Item
              className={themeMode === 'dark' ? 'custom-list-item dark' : 'custom-list-item'}
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-start',
                padding: '4px 8px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('noMatchingLabels')}
              </Typography.Text>
            </List.Item>
          ) : (
            <List.Item
              className={themeMode === 'dark' ? 'custom-list-item dark' : 'custom-list-item'}
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-start',
                padding: '4px 8px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('noLabels')}
              </Typography.Text>
            </List.Item>
          )}
        </List>

        <Flex style={{ paddingTop: 8 }} vertical justify="space-between" gap={8}>
          <Input
            ref={labelsInputRef}
            value={createLabelText}
            onChange={e => onCreateLabelTextChange(e.currentTarget.value)}
            placeholder={t('searchOrCreateLabel')}
            onPressEnter={() => {
              isOnApply();
            }}
          />
          {createLabelText && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {exactMatch ? t('labelExists') : t('hitEnterToCreate')}
            </Typography.Text>
          )}
          <Button
            type="primary"
            size="small"
            onClick={isOnApply}
            style={{ width: '100%' }}
            disabled={!createLabelText.trim() && selectedLabels.length === 0}
          >
            {t('apply')}
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
};

export default LabelsDropdown;
