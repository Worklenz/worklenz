
import { useEffect, useState } from 'react';
import { Button, ColorPicker, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

interface SelectionColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  ariaLabel?: string;
}

const SelectionColorPicker = ({
  value,
  onChange,
  ariaLabel,
}: SelectionColorPickerProps) => {
  const { t } = useTranslation('task-list-table');
  const { token } = theme.useToken();
  const [color, setColor] = useState(value);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setColor(value);
  }, [value]);

  const handleApply = () => {
    onChange(color);
    setPickerOpen(false);
  };

  return (
    <ColorPicker
      value={color}
      open={pickerOpen}
      onOpenChange={setPickerOpen}
      onChange={nextColor => setColor(nextColor.toHexString())}
      size="small"
      disabledAlpha
      panelRender={panel => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {panel}
          <Button type="primary" size="small" block onClick={handleApply}>
            {t('apply', { defaultValue: 'Apply' })}
          </Button>
        </div>
      )}
    >
      <button
        type="button"
        aria-label={ariaLabel || t('customColumns.dependentSelection.optionColorLabel', {
          defaultValue: 'Option color',
        })}
        style={{
          width: 16,
          height: 16,
          padding: 0,
          borderRadius: 3,
          cursor: 'pointer',
          backgroundColor: color,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      />
    </ColorPicker>
  );
};

export default SelectionColorPicker;
