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
  providerKey: string;
  sourceLabel: string;
  fieldMappings: Record<string, string>;
  csvColumns: string[];
  statusValueMapping: Record<string, string>;
  csvUserRows: string[];
  userEmails: Record<string, string>;
  addUsers: boolean;
  csvRows: Record<string, any>[];
}

export const CsvReviewStepContent: React.FC<CsvReviewStepContentProps> = ({
  t,
  themeToken,
  spaceName,
  providerKey,
  sourceLabel,
  fieldMappings,
  csvColumns,
  statusValueMapping,
  csvUserRows,
  userEmails,
  addUsers,
  csvRows,
}) => {
  const reviewSpaceName = spaceName || t('importStep.defaultProjectName', 'Imported project');
  const mappedFields = Object.values(fieldMappings).filter(Boolean).length;
  const totalFields = csvColumns.length;
  const workTypes = Object.values(statusValueMapping).filter(Boolean).length || 1;
  const usersCount = csvUserRows.filter(user => {
    const email = (userEmails[user] || '').trim();
    return addUsers && !!email && email.includes('@');
  }).length;
  const workItems = csvRows.length;
  const limitationItems = React.useMemo(() => {
    const lowerProvider = (providerKey || '').toLowerCase();
    if (lowerProvider === 'jira') {
      return [
        t('importStep.limitationsJiraCommentFormat', {
          defaultValue: 'Rich-text comments are imported as plain text when advanced formatting is not supported.',
        }),
        t('importStep.limitationsJiraAttachmentPermission', {
          defaultValue: 'Attachments can be skipped if source file permissions or URLs are inaccessible.',
        }),
        t('importStep.limitationsJiraUserAttribution', {
          defaultValue: 'Comment and assignee attribution depends on matching users by email or mapped identity.',
        }),
      ];
    }

    if (lowerProvider === 'asana') {
      return [
        t('importStep.limitationsAsanaSections', {
          defaultValue: 'Section values are mapped to statuses and may require manual refinement.',
        }),
        t('importStep.limitationsAsanaLikes', {
          defaultValue: 'Likes are imported as field values; reactions do not create social activity in Worklenz.',
        }),
        t('importStep.limitationsAsanaUsers', {
          defaultValue: 'Users who are not added to the team remain unresolved in assignee and reporter mappings.',
        }),
      ];
    }

    return [
      t('importStep.limitationsCsvFormatting', {
        defaultValue: 'CSV formulas and visual formatting are not imported; only cell values are used.',
      }),
      t('importStep.limitationsCsvDates', {
        defaultValue: 'Date parsing uses detected formats and may need manual field/status adjustments after import.',
      }),
      t('importStep.limitationsCsvUsers', {
        defaultValue: 'User references without valid emails stay unassigned until users are matched in Worklenz.',
      }),
    ];
  }, [providerKey, t]);

  const handleDownloadConfig = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const config = {
      spaceName: reviewSpaceName,
      fieldMappings,
      statusValueMapping,
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'worklenz-import-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };
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
                defaultValue: '{{count}} status',
                count: workTypes,
              })}
            </div>
            <div style={{ color: themeToken.colorTextSecondary, fontSize: 15 }}>
              {t('importStep.reviewWorkTypesCardDescription', {
                defaultValue:
                  'If values are not mapped to Worklenz statuses, all tasks are mapped to Task (level 0) by default.',
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
                count: workItems,
              })}
            </div>
            <div style={{ color: themeToken.colorTextSecondary, fontSize: 15 }}>
              {t('importStep.reviewWorkItemsCardDescription', {
                defaultValue: 'Each row of the CSV data will be imported as a task.',
              })}
            </div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 32, color: themeToken.colorTextSecondary, fontSize: 15 }}>
        <a href="#" onClick={handleDownloadConfig} style={{ color: themeToken.colorTextSecondary, textDecoration: 'underline' }}>
          {t('importStep.downloadConfiguration', {
            defaultValue: 'Download a configuration file',
          })}
        </a>{' '}
        {t('importStep.downloadConfigurationSuffix', {
          defaultValue: 'to use the same space preferences in your next import.',
        })}
      </div>
      <div
        style={{
          marginTop: 20,
          maxWidth: 600,
          borderRadius: 12,
          border: `1px solid ${themeToken.colorBorder}`,
          background: themeToken.colorFillQuaternary || themeToken.colorBgContainer,
          padding: '14px 16px',
        }}
      >
        <Typography.Text style={{ color: themeToken.colorText, fontWeight: 600 }}>
          {t('importStep.importLimitationsTitle', {
            defaultValue: 'Import limitations',
          })}
        </Typography.Text>
        <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, margin: '6px 0 10px' }}>
          {t('importStep.importLimitationsDescription', {
            defaultValue: 'Heads up before importing from {{source}}:',
            source: sourceLabel || 'your source',
          })}
        </Typography.Paragraph>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {limitationItems.map((item, index) => (
            <Typography.Text key={`${item}-${index}`} style={{ color: themeToken.colorTextSecondary }}>
              • {item}
            </Typography.Text>
          ))}
        </div>
      </div>
    </div>
  );
};
