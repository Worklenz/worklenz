import { Button, Dropdown } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { ILanguageType, setLanguage } from './localesSlice';

const LanguageSelector = () => {
  const language = useAppSelector(state => state.localesReducer.lng);
  const dispatch = useAppDispatch();

  const handleLanguageChange = (lang: ILanguageType) => {
    dispatch(setLanguage(lang));
  };

  const items = [
    { key: 'en', label: 'English' },
    { key: 'es', label: 'Español' },
    { key: 'pt', label: 'Português' },
    { key: 'alb', label: 'Shqip' },
    { key: 'de', label: 'Deutsch' },
    { key: 'zh_cn', label: '简体中文' },
  ];

  const languageLabels = {
    en: 'En',
    es: 'Es',
    pt: 'Pt',
    alb: 'Sq',
    de: 'de',
    zh_cn: 'zh_cn',
  };

  return (
    <Dropdown
      menu={{
        items: items.map(item => ({
          ...item,
          onClick: () => handleLanguageChange(item.key as ILanguageType),
        })),
      }}
      placement="bottom"
      trigger={['click']}
    >
      <Button
        shape="circle"
        style={{
          textTransform: 'capitalize',
          fontWeight: 500,
          minWidth: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Change language"
      >
        {languageLabels[language]}
      </Button>
    </Dropdown>
  );
};

export default LanguageSelector;
