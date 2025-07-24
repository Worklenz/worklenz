import { ConfigProvider, Flex, Menu, MenuProps } from '@/shared/antd-imports';
import { Link, useLocation } from 'react-router-dom';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { reportingsItems } from '@/lib/reporting/reporting-constants';
import { useMemo } from 'react';

const ReportingSider = () => {
  const location = useLocation();
  const { t } = useTranslation('reporting-sidebar');

  // Memoize the menu items since they only depend on translations
  const menuItems = useMemo(
    () =>
      reportingsItems.map(item => {
        if (item.children) {
          return {
            key: item.key,
            label: t(`${item.name}`),
            children: item.children.map(child => ({
              key: child.key,
              label: <Link to={`/worklenz/reporting/${child.endpoint}`}>{t(`${child.name}`)}</Link>,
            })),
          };
        }
        return {
          key: item.key,
          label: <Link to={`/worklenz/reporting/${item.endpoint}`}>{t(`${item.name}`)}</Link>,
        };
      }),
    [t]
  ); // Only recompute when translations change

  // Memoize the active key calculation
  const activeKey = useMemo(() => {
    const afterWorklenzString = location.pathname?.split('/worklenz/reporting/')[1];
    return afterWorklenzString?.split('/')[0];
  }, [location.pathname]);

  return (
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            subMenuItemBg: colors.transparent,
          },
        },
      }}
    >
      <Flex gap={24} vertical>
        <Menu
          className="custom-reporting-sider"
          items={menuItems}
          selectedKeys={[activeKey]}
          mode="inline"
          style={{ width: '100%' }}
        />
      </Flex>
    </ConfigProvider>
  );
};

export default ReportingSider;
