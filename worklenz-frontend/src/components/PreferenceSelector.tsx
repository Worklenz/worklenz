import { FloatButton, Space, Tooltip } from 'antd';
import { FormatPainterOutlined } from '@ant-design/icons';
import LanguageSelector from '../features/i18n/language-selector';
import ThemeSelector from '../features/theme/ThemeSelector';

const PreferenceSelector = () => {
  return (
    <Tooltip title="Preferences" placement="leftBottom">
      <div>
        <FloatButton.Group trigger="click" icon={<FormatPainterOutlined />}>
          <Space
            direction="vertical"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ThemeSelector />
          </Space>
        </FloatButton.Group>
      </div>
    </Tooltip>
  );
};

export default PreferenceSelector;
