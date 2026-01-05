import { Flex, Layout } from '@/shared/antd-imports';
import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout = () => {
  return (
    <Layout
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: '100vh',
        width: '100%',
      }}
    >
      <Flex
        style={{
          marginBlockStart: 96,
          marginBlockEnd: 48,
          marginInline: 24,
          width: '90%',
          maxWidth: 440,
        }}
      >
        <Outlet />
      </Flex>
    </Layout>
  );
};

export default AuthLayout;
