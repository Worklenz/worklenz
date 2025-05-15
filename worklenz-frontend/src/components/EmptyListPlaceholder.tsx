import { Empty, Typography } from 'antd';
import React from 'react';

type EmptyListPlaceholderProps = {
  imageSrc?: string;
  imageHeight?: number;
  text: string;
};

const EmptyListPlaceholder = ({
  imageSrc = '/src/assets/images/empty-box.webp',
  imageHeight = 60,
  text,
}: EmptyListPlaceholderProps) => {
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
      description={<Typography.Text type="secondary">{text}</Typography.Text>}
    />
  );
};

export default EmptyListPlaceholder;
