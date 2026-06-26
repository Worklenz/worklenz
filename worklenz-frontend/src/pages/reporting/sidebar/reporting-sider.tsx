import { Menu, Button } from '@/shared/antd-imports';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { reportingsItems } from '@/lib/reporting/reporting-constants';
import { useMemo } from 'react';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@/shared/antd-imports';
import './reporting-sider.css';

interface ReportingSiderProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ReportingSider: React.FC<ReportingSiderProps> = ({ collapsed = false, onToggleCollapse }) => {
  const location = useLocation();
  const { t } = useTranslation('reporting-sidebar');

  // Memoize the menu items since they only depend on translations
  const menuItems = useMemo(
    () =>
      reportingsItems.flatMap((item, index) => {
        const items = [];

        // Add divider before time reports group
        if (item.children && item.key === 'time-sheet') {
          items.push({
            key: `divider-${item.key}`,
            type: 'divider' as const,
          });
        }

        if (item.children) {
          items.push({
            key: item.key,
            icon: item.icon,
            label: t(`${item.name}`, { defaultValue: item.defaultValue }),
            type: 'group' as const,
            children: item.children.map(child => ({
              key: child.key,
              icon: child.icon,
              label: (
                <Link to={`/worklenz/reporting/${child.endpoint}`}>
                  {t(`${child.name}`, { defaultValue: child.defaultValue })}
                </Link>
              ),
            })),
          });
        } else {
          items.push({
            key: item.key,
            icon: item.icon,
            label: (
              <Link to={`/worklenz/reporting/${item.endpoint}`}>
                {t(`${item.name}`, { defaultValue: item.defaultValue })}
              </Link>
            ),
          });
        }

        return items;
      }),
    [t]
  );

  // Memoize the active key calculation
  const activeKey = useMemo(() => {
    const afterWorklenzString = location.pathname?.split('/worklenz/reporting/')[1];
    return afterWorklenzString?.split('/')[0];
  }, [location.pathname]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >

      {/* Collapse toggle button at top */}
      {onToggleCollapse && (
        <div
          style={{
            padding: collapsed ? 16 : '16px 16px 8px',
            display: 'flex',
            justifyContent: collapsed ? 'center' : 'flex-end',
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={onToggleCollapse}
            size="small"
          />
        </div>
      )}

      {/* Menu */}
      <div style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '8px 0' : '8px' }}>
        <Menu
          className="custom-reporting-sider"
          items={menuItems}
          selectedKeys={[activeKey]}
          defaultOpenKeys={['time-sheet']}
          mode="inline"
          inlineCollapsed={collapsed}
          style={{ border: 'none' }}
        />
      </div>
    </div>
  );
};

export default ReportingSider;
