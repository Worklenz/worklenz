import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Flex, Typography, theme, CaretRightFilled } from '@/shared/antd-imports';
import { FilterPill, DateNavRow } from './PlannerMockupChrome';

const { useToken } = theme;
const { Text } = Typography;

const YEARS = [
  { label: '2025', span: 4 },
  { label: '2026', span: 4 },
  { label: '2027', span: 2 },
];
const MONTHS = ['Jan', 'Apr', 'Jul', 'Oct', 'Jan', 'Apr', 'Jul', 'Oct', 'Jan', 'Apr'];
const TODAY_PCT = 55;
const GRID_MIN_WIDTH = 900;

interface ProjectRow {
  name: string;
  range: string;
  color: string;
  light: string;
  kind: 'bar' | 'marker' | 'planned';
  start: number;
  solidWidth?: number;
  hatchWidth?: number;
}

const PROJECTS: ProjectRow[] = [
  { name: 'Nimbus Retail Website', range: '2025-01 – 2026-07', color: '#1677ff', light: '#bae0ff', kind: 'bar', start: 0, solidWidth: 25, hatchWidth: 35 },
  { name: 'Beacon Logistics Platform', range: '2025-01 – 2025-09', color: '#ff4d4f', light: '#ffccc7', kind: 'bar', start: 0, solidWidth: 15, hatchWidth: 20 },
  { name: 'Solace Patient Portal', range: '2025-04-23', color: '#faad14', light: '#faad14', kind: 'marker', start: 18 },
  { name: 'Vertex Inventory System', range: '2025-05 – 2028-07', color: '#1677ff', light: '#bae0ff', kind: 'bar', start: 15, solidWidth: 20, hatchWidth: 30 },
  { name: 'Reporting Revamp', range: '2025-06 – 2027-01', color: '#722ed1', light: '#efdbff', kind: 'planned', start: 22, hatchWidth: 33 },
  { name: 'Kanban Board Testing', range: '2025-07 – 2027-06', color: '#1677ff', light: '#bae0ff', kind: 'bar', start: 20, solidWidth: 25, hatchWidth: 25 },
  { name: 'Northwind Studio Refresh', range: '2025-07-30', color: '#ff4d4f', light: '#ff4d4f', kind: 'marker', start: 40 },
  { name: 'Client Onboarding Flow', range: '2025-08 – 2026-12', color: '#52c41a', light: '#d9f7be', kind: 'bar', start: 25, solidWidth: 10, hatchWidth: 40 },
  { name: 'Mobile App Revamp', range: '2025-09 – 2027-03', color: '#722ed1', light: '#efdbff', kind: 'bar', start: 28, solidWidth: 18, hatchWidth: 32 },
  { name: 'Billing Automation', range: '2025-10-14', color: '#faad14', light: '#faad14', kind: 'marker', start: 30 },
  { name: 'Vendor Portal Launch', range: '2025-11 – 2027-08', color: '#13c2c2', light: '#b5f5ec', kind: 'bar', start: 32, solidWidth: 22, hatchWidth: 30 },
  { name: 'Data Warehouse Migration', range: '2026-01 – 2026-10', color: '#2f54eb', light: '#adc6ff', kind: 'planned', start: 45, hatchWidth: 25 },
];

const PlannerTimelinePreviewMockup: React.FC = () => {
  const { token } = useToken();
  const border = `1px solid ${token.colorBorderSecondary}`;
  const { t } = useTranslation(['upgrade-preview', 'schedule']);
  const tc = (key: string, defaultValue: string) =>
    t(`plannerMockup.chrome.${key}`, { defaultValue, ns: 'upgrade-preview' });

  const FILTERS = [
    t('allProjects', { ns: 'schedule', defaultValue: 'All projects' }),
    t('status', { ns: 'schedule', defaultValue: 'Status' }),
    tc('priority', 'Priority'),
    tc('category', 'Category'),
    t('allClients', { ns: 'schedule', defaultValue: 'All clients' }),
  ];

  return (
    <Flex vertical gap={12} style={{ height: '100%', minHeight: 0 }}>
      <Flex gap={8} wrap="wrap">
        {FILTERS.map(f => (
          <FilterPill key={f} label={f} />
        ))}
      </Flex>

      <DateNavRow
        label="Jan 2025 - Dec 2029"
        viewOptions={[tc('weeksOption', 'Weeks'), tc('quartersOption', 'Quarters'), tc('yearsOption', 'Years')]}
        activeView={tc('quartersOption', 'Quarters')}
      />

      <Card
        style={{ flex: 1, minHeight: 0 }}
        styles={{ body: { padding: 0, height: '100%', overflow: 'auto' } }}
      >
        <div style={{ minWidth: GRID_MIN_WIDTH, display: 'grid', gridTemplateColumns: '200px 1fr' }}>
          <div style={{ borderBottom: border }} />
          <div>
            <Flex>
              {YEARS.map(y => (
                <div
                  key={y.label}
                  style={{ flex: y.span, textAlign: 'center', fontSize: 11, fontWeight: 600, color: token.colorTextTertiary, padding: '4px 0' }}
                >
                  {y.label}
                </div>
              ))}
            </Flex>
            <Flex style={{ borderBottom: border }}>
              {MONTHS.map((m, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: token.colorTextQuaternary, paddingBottom: 6 }}>
                  {m}
                </div>
              ))}
            </Flex>
          </div>

          {PROJECTS.map(p => (
            <React.Fragment key={p.name}>
              <div style={{ padding: '10px 12px', borderTop: border }}>
                <Text strong style={{ fontSize: 12 }}>
                  {p.name}
                </Text>
                <div style={{ fontSize: 11, color: token.colorTextTertiary }}>{p.range}</div>
              </div>
              <div
                style={{
                  position: 'relative',
                  borderTop: border,
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: `${TODAY_PCT}%`,
                    top: 0,
                    bottom: 0,
                    borderLeft: `1px dashed ${token.colorBorder}`,
                  }}
                />
                {p.kind === 'marker' && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${p.start}%`,
                      width: 3,
                      height: 20,
                      borderRadius: 2,
                      background: p.color,
                    }}
                  />
                )}
                {p.kind === 'planned' && (
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        left: `${p.start}%`,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: p.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <CaretRightFilled style={{ fontSize: 8, color: '#fff' }} />
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        left: `${(p.start ?? 0) + 3}%`,
                        width: `${p.hatchWidth}%`,
                        height: 16,
                        borderRadius: 8,
                        border: `1px solid ${p.color}`,
                      }}
                    />
                  </>
                )}
                {p.kind === 'bar' && (
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        left: `${p.start}%`,
                        width: `${p.solidWidth}%`,
                        height: 16,
                        borderRadius: '8px 0 0 8px',
                        background: p.color,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: `${p.start + (p.solidWidth ?? 0)}%`,
                        width: `${p.hatchWidth}%`,
                        height: 16,
                        borderRadius: '0 8px 8px 0',
                        background: `repeating-linear-gradient(45deg, ${p.light} 0 3px, transparent 3px 7px)`,
                        backgroundColor: `${p.light}55`,
                      }}
                    />
                  </>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>
      </Card>
    </Flex>
  );
};

export default PlannerTimelinePreviewMockup;
