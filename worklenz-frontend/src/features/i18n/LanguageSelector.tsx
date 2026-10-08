import { Button, Dropdown } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { ILanguageType, Language, setLanguage } from './localesSlice';

const LanguageSelector = () => {
  const language = useAppSelector(state => state.localesReducer.lng);
  const dispatch = useAppDispatch();

  const handleLanguageChange = (lang: ILanguageType) => {
    dispatch(setLanguage(lang));
  };

  const items: Array<{ key: ILanguageType; label: string }> = [
    { key: Language.EN, label: 'English' },
    { key: Language.ES, label: 'Español' },
    { key: Language.PT, label: 'Português' },
    { key: Language.ALB, label: 'Shqip' },
    { key: Language.DE, label: 'Deutsch' },
    { key: Language.ZH, label: '简体中文' },
    { key: Language.PL, label: 'Polski' },
    { key: Language.FR, label: 'Français' },
  ];

  const languageLabels: Record<ILanguageType, string> = {
    [Language.EN]: 'En',
    [Language.ES]: 'Es',
    [Language.PT]: 'Pt',
    [Language.ALB]: 'Sq',
    [Language.DE]: 'De',
    [Language.ZH]: 'Zh',
    [Language.PL]: 'Pl',
    [Language.FR]: 'Fr',
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
