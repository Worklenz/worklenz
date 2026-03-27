import React from 'react';
import { Typography } from '@/shared/antd-imports';

interface CsvReviewStepContentProps {
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
  spaceName: string;
  spaceType: string;
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
  spaceName,
  spaceType,
  fieldMappings,
  csvColumns,
  workTypeMapping,
  csvUserRows,
  userEmails,
  addUsers,
  csvRows,
}) => {
  const reviewSpaceName = spaceName || t('importStep.defaultSpaceName', 'Imported space');
  const reviewSpaceType = spaceType || 'software';
  const mappedFields = Object.values(fieldMappings).filter(Boolean).length;
  const totalFields = csvColumns.length;
  const workTypes = Object.values(workTypeMapping).filter(Boolean).length || 1;
  const usersCount = csvUserRows.filter(user => {
    const email = (userEmails[user] || '').trim();
    return addUsers && !!email && email.includes('@');
  }).length;
  const workItems = csvRows.length;

  return (
    <div style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ color: '#fff', marginBottom: 8 }}>
        {t('importStep.reviewSpaceDetails', { defaultValue: 'Review space details' })}
      </Typography.Title>
      <Typography.Paragraph style={{ color: '#b0b0b0', marginBottom: 24 }}>
        {t('importStep.reviewSpaceDetailsHelp', {
          defaultValue:
            "We're ready to import your team's data. Here's a summary of what will be imported into Worklenz.",
        })}
      </Typography.Paragraph>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#18181a',
            borderRadius: 12,
            padding: 20,
            gap: 20,
          }}
        >
          <img
            src="https://img.icons8.com/fluency/48/000000/trello.png"
            alt="space"
            style={{ width: 48, height: 48 }}
          />
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>
              {t('importStep.reviewSpaceCardTitle', {
                defaultValue: '1 Worklenz space: {{spaceName}}',
                spaceName: reviewSpaceName,
              })}
            </div>
            <div style={{ color: '#b0b0b0', fontSize: 15 }}>
              {t('importStep.reviewSpaceCardDescription', {
                defaultValue: 'A team-managed software space ({{spaceType}}) will be created.',
                spaceType: reviewSpaceType,
              })}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#18181a',
            borderRadius: 12,
            padding: 20,
            gap: 20,
          }}
        >
          <img
            src="https://img.icons8.com/fluency/48/000000/columns.png"
            alt="fields"
            style={{ width: 48, height: 48 }}
          />
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>
              {t('importStep.reviewFieldsCardTitle', {
                defaultValue: '{{mapped}}/{{total}} fields',
                mapped: mappedFields,
                total: totalFields,
              })}
            </div>
            <div style={{ color: '#b0b0b0', fontSize: 15 }}>
              {t('importStep.reviewFieldsCardDescription', {
                defaultValue: '{{mapped}} columns will be mapped to existing Worklenz fields.',
                mapped: mappedFields,
              })}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#18181a',
            borderRadius: 12,
            padding: 20,
            gap: 20,
          }}
        >
          <img
            src="https://img.icons8.com/fluency/48/000000/task.png"
            alt="work type"
            style={{ width: 48, height: 48 }}
          />
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>
              {t('importStep.reviewWorkTypesCardTitle', {
                defaultValue: '{{count}} work type',
                count: workTypes,
              })}
            </div>
            <div style={{ color: '#b0b0b0', fontSize: 15 }}>
              {t('importStep.reviewWorkTypesCardDescription', {
                defaultValue:
                  'If values are not mapped to Worklenz work types, all work items are mapped to Task (level 0) by default.',
              })}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#18181a',
            borderRadius: 12,
            padding: 20,
            gap: 20,
          }}
        >
          <img
            src="https://img.icons8.com/fluency/48/000000/add-user-group-man-man.png"
            alt="users"
            style={{ width: 48, height: 48 }}
          />
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>
              {usersCount === 0
                ? t('importStep.reviewUsersNone', { defaultValue: 'No users' })
                : t('importStep.reviewUsersCount', {
                    defaultValue: '{{count}} users',
                    count: usersCount,
                  })}
            </div>
            <div style={{ color: '#b0b0b0', fontSize: 15 }}>
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

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#18181a',
            borderRadius: 12,
            padding: 20,
            gap: 20,
          }}
        >
          <img
            src="https://img.icons8.com/fluency/48/000000/list.png"
            alt="work items"
            style={{ width: 48, height: 48 }}
          />
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>
              {t('importStep.reviewWorkItemsCardTitle', {
                defaultValue: '{{count}} work items',
                count: workItems,
              })}
            </div>
            <div style={{ color: '#b0b0b0', fontSize: 15 }}>
              {t('importStep.reviewWorkItemsCardDescription', {
                defaultValue: 'Each row of the CSV data will be imported as a work item.',
              })}{' '}
              <a href="#" style={{ color: '#4096ff' }}>
                {t('importStep.reviewWorkItemsDocs', {
                  defaultValue: 'What is a work item?',
                })}
              </a>
            </div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 32, color: '#8fa7d3', fontSize: 15 }}>
        <a href="#" style={{ color: '#8fa7d3', textDecoration: 'underline' }}>
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
