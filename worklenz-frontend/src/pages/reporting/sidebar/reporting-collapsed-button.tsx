import { GlobalOutlined, LeftCircleOutlined, RightCircleOutlined } from '@/shared/antd-imports';
import React, { useEffect, useState } from 'react';
import { colors } from '@/styles/colors';
import { Button, Flex, Tooltip, Typography } from '@/shared/antd-imports';
import { themeWiseColor } from '@utils/themeWiseColor';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { IOrganization } from '@/types/admin-center/admin-center.types';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import logger from '@/utils/errorLogger';

const ReportingCollapsedButton = ({
  isCollapsed,
  handleCollapseToggler,
}: {
  isCollapsed: boolean;
  handleCollapseToggler: () => void;
}) => {
  // localization
  const { t } = useTranslation('reporting-sidebar');

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // State for organization name and loading
  const [organization, setOrganization] = useState<IOrganization | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch organization details
  const getOrganizationDetails = async () => {
    setLoading(true);
    try {
      const res = await adminCenterApiService.getOrganizationDetails();
      if (res.done) {
        setOrganization(res.body);
      }
    } catch (error) {
      logger.error('Error getting organization details', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getOrganizationDetails();
  }, []);

  return (
    <Flex
      align="center"
      justify="space-between"
      style={{
        marginBlockStart: 76,
        marginBlockEnd: 24,
        maxWidth: 160,
        height: 40,
      }}
    >
      {!isCollapsed && (
        <Tooltip title={!isCollapsed && t('currentOrganizationTooltip')} trigger={'hover'}>
          <Flex gap={8} align="center" style={{ marginInlineStart: 16 }}>
            <GlobalOutlined
              style={{
                color: themeWiseColor(colors.darkGray, colors.white, themeMode),
              }}
            />

            <Typography.Text strong>
              {loading ? 'Loading...' : organization?.name || 'Unknown Organization'}
            </Typography.Text>
          </Flex>
        </Tooltip>
      )}
      <Button
        className="borderless-icon-btn"
        style={{
          background: themeWiseColor(colors.white, colors.darkGray, themeMode),
          boxShadow: 'none',
          padding: 0,
          zIndex: 120,
          transform: 'translateX(50%)',
        }}
        onClick={() => handleCollapseToggler()}
        icon={
          isCollapsed ? (
            <RightCircleOutlined
              style={{
                fontSize: 22,
                color: themeWiseColor('#c5c5c5', colors.lightGray, themeMode),
              }}
            />
          ) : (
            <LeftCircleOutlined
              style={{
                fontSize: 22,
                color: themeWiseColor('#c5c5c5', colors.lightGray, themeMode),
              }}
            />
          )
        }
      />
    </Flex>
  );
};

export default ReportingCollapsedButton;
