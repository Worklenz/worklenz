import { Empty, Typography } from '@/shared/antd-imports';
import React from 'react';
import { useTranslation } from 'react-i18next';

type EmptyListPlaceholderProps = {
  imageSrc?: string;
  imageHeight?: number;
  text?: string;
  textKey?: string;
  i18nNs?: string;
};

const EmptyListPlaceholder = ({
  imageSrc = 'https://s3.us-west-2.amazonaws.com/worklenz.com/assets/empty-box.webp',
  imageHeight = 60,
  text,
  textKey,
  i18nNs = 'task-list-table',
}: EmptyListPlaceholderProps) => {
  const { t } = useTranslation(i18nNs);
  const description = textKey ? t(textKey) : text;
  return (
    <Empty
      image={imageSrc}
      imageStyle={{ height: imageHeight }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBlockStart: 24,
      }}
      description={<Typography.Text type="secondary">{description}</Typography.Text>}
    />
  );
};

export default EmptyListPlaceholder;
