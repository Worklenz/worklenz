import React from 'react';
import notFoundImg from '../../assets/images/not-found-img.png';
import { Button, Flex, Layout, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

const NotFoundPage = () => {
  // Localization
  const { t } = useTranslation('404-page');

  return (
    <Layout
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginInline: 'auto',
        minHeight: '100vh',
        paddingInline: 24,
      }}
    >
      <img src={notFoundImg} alt="not found page" style={{ width: '100%', maxWidth: 800 }} />
      <Flex vertical gap={8} align="center">
        <Typography.Title style={{ marginBlockEnd: 0 }}>404</Typography.Title>
        <Typography.Text style={{ textAlign: 'center' }}>{t('doesNotExistText')}</Typography.Text>
        <Button type="primary" href="/worklenz/home">
          {t('backHomeButton')}
        </Button>
      </Flex>
    </Layout>
  );
};

export default NotFoundPage;
