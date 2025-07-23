import { FloatButton, Space, Tooltip } from '@/shared/antd-imports';
import { FormatPainterOutlined } from '@/shared/antd-imports';
// import LanguageSelector from '../features/i18n/language-selector';
// import ThemeSelector from '../features/theme/ThemeSelector';

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
            {/* <ThemeSelector /> */}
          </Space>
        </FloatButton.Group>
      </div>
    </Tooltip>
  );
};

export default PreferenceSelector;
