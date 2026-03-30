import React from 'react';
import {
  ProjectOutlined,
  TableOutlined,
  TagsOutlined,
  UserAddOutlined,
  UnorderedListOutlined,
  Typography,
} from '@/shared/antd-imports';

interface CsvReviewStepContentProps {
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
  themeToken: any;
  spaceName: string;
  fieldMappings: Record<string, string>;
  csvColumns: string[];
  workTypeMapping: Record<string, string>;
  csvUserRows: string[];
  userEmails: Record<string, string>;
  addUsers: boolean;
  csvRows: Record<string, any>[];
}

export const CsvReviewStepContent: React.FC<CsvReviewStepContentProps> = ({
  t,
  themeToken,
  spaceName,
  fieldMappings,
  csvColumns,
  workTypeMapping,
  csvUserRows,
  userEmails,
  addUsers,
  csvRows,
}) => {
  const reviewSpaceName = spaceName || t('importStep.defaultProjectName', 'Imported project');
  const mappedFields = Object.values(fieldMappings).filter(Boolean).length;
  const totalFields = csvColumns.length;
  const workTypes = Object.values(workTypeMapping).filter(Boolean).length || 1;
  const usersCount = csvUserRows.filter(user => {
    const email = (userEmails[user] || '').trim();
    return addUsers && !!email && email.includes('@');
  }).length;
  const tasksCount = csvRows.length;
  const cardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    background: themeToken.colorBgContainer,
    borderRadius: 12,
    padding: 20,
    gap: 20,
  };
  const iconStyle: React.CSSProperties = {
    width: 48,
    height: 48,
    display: 'grid',
    placeItems: 'center',
    fontSize: 28,
    color: themeToken.colorPrimary,
    background: themeToken.colorFillSecondary,
    borderRadius: 10,
    flex: '0 0 48px',
  };

  return (
    <div style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ color: themeToken.colorText, marginBottom: 8 }}>
        {t('importStep.reviewProjectDetails', { defaultValue: 'Review project details' })}
      </Typography.Title>
      <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, marginBottom: 24 }}>
        {t('importStep.reviewSpaceDetailsHelp', {
          defaultValue:
            "We're ready to import your team's data. Here's a summary of what will be imported into Worklenz.",
        })}
      </Typography.Paragraph>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
        <div style={cardStyle}>
          <div style={iconStyle} aria-hidden="true">
            <ProjectOutlined />
          </div>
          <div>
            <div style={{ color: themeToken.colorText, fontWeight: 600, fontSize: 18 }}>
              {t('importStep.reviewProjectCardTitle', {
                defaultValue: '1 project: {{spaceName}}',
                spaceName: reviewSpaceName,
              })}
            </div>
            <div style={{ color: themeToken.colorTextSecondary, fontSize: 15 }}>
              {t('importStep.reviewProjectCardDescription', {
                defaultValue: 'A new Worklenz project will be created for this import.',
              })}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={iconStyle} aria-hidden="true">
            <TableOutlined />
          </div>
          <div>
            <div style={{ color: themeToken.colorText, fontWeight: 600, fontSize: 18 }}>
              {t('importStep.reviewFieldsCardTitle', {
                defaultValue: '{{mapped}}/{{total}} fields',
                mapped: mappedFields,
                total: totalFields,
              })}
            </div>
            <div style={{ color: themeToken.colorTextSecondary, fontSize: 15 }}>
              {t('importStep.reviewFieldsCardDescription', {
                defaultValue: '{{mapped}} columns will be mapped to existing Worklenz fields.',
                mapped: mappedFields,
              })}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={iconStyle} aria-hidden="true">
            <TagsOutlined />
          </div>
          <div>
            <div style={{ color: themeToken.colorText, fontWeight: 600, fontSize: 18 }}>
              {t('importStep.reviewWorkTypesCardTitle', {
                defaultValue: '{{count}} work type',
                count: workTypes,
              })}
            </div>
            <div style={{ color: themeToken.colorTextSecondary, fontSize: 15 }}>
              {t('importStep.reviewWorkTypesCardDescription', {
                defaultValue:
                  'If values are not mapped to Worklenz work types, all tasks are mapped to Task (level 0) by default.',
              })}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={iconStyle} aria-hidden="true">
            <UserAddOutlined />
          </div>
          <div>
            <div style={{ color: themeToken.colorText, fontWeight: 600, fontSize: 18 }}>
              {usersCount === 0
                ? t('importStep.reviewUsersNone', { defaultValue: 'No users' })
                : t('importStep.reviewUsersCount', {
                    defaultValue: '{{count}} users',
                    count: usersCount,
                  })}
            </div>
            <div style={{ color: themeToken.colorTextSecondary, fontSize: 15 }}>
              {usersCount === 0
                ? t('importStep.reviewUsersNoneDescription', {
                    defaultValue:
                      "You haven't added users to the space. Assignee/reporter fields will be unassigned and @mentions become plain text.",
                  })
                : t('importStep.reviewUsersAddedDescription', {
                    defaultValue: 'Users will be added to the space.',
                  })}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={iconStyle} aria-hidden="true">
            <UnorderedListOutlined />
          </div>
          <div>
            <div style={{ color: themeToken.colorText, fontWeight: 600, fontSize: 18 }}>
              {t('importStep.reviewWorkItemsCardTitle', {
                defaultValue: '{{count}} tasks',
                count: tasksCount,
              })}
            </div>
            <div style={{ color: themeToken.colorTextSecondary, fontSize: 15 }}>
              {t('importStep.reviewWorkItemsCardDescription', {
                defaultValue: 'Each row of the CSV data will be imported as a task.',
              })}{' '}
              <a href="#" style={{ color: themeToken.colorPrimary }}>
                {t('importStep.reviewWorkItemsDocs', {
                  defaultValue: 'What is a task?',
                })}
              </a>
            </div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 32, color: themeToken.colorTextSecondary, fontSize: 15 }}>
        <a href="#" style={{ color: themeToken.colorTextSecondary, textDecoration: 'underline' }}>
          {t('importStep.downloadConfiguration', {
            defaultValue: 'Download a configuration file',
          })}
        </a>{' '}
        {t('importStep.downloadConfigurationSuffix', {
          defaultValue: 'to use the same space preferences in your next import.',
        })}
      </div>
    </div>
  );
};
