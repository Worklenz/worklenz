import { Tag, Tooltip } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { openWhatsNewModal } from '@/features/whats-new/whatsNewSlice';

const WhatsNewTag = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('navbar');
  const currentRelease = useAppSelector(state => state.whatsNewReducer.currentRelease);

  if (!currentRelease) return null;

  return (
    <Tooltip title={t('whatsNew.tooltip', { defaultValue: 'See what changed in this release' })}>
      <Tag
        color="blue"
        onClick={() => dispatch(openWhatsNewModal())}
        style={{
          cursor: 'pointer',
          borderRadius: 999,
          padding: '2px 12px',
          margin: 0,
          fontWeight: 500,
        }}
      >
        {t('whatsNew.tag', { defaultValue: "What's New" })}
      </Tag>
    </Tooltip>
  );
};

export default WhatsNewTag;
