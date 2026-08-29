import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Flex, Typography, theme, Avatar } from '@/shared/antd-imports';
import { FilterPill, DateNavRow, ViewToggleGroup, CHIP_COLORS, HIGHLIGHT_TINTS } from './PlannerMockupChrome';

const { useToken } = theme;
const { Text } = Typography;

const DAYS = [
  { label: 'Mon 20', sub: 'Jul' },
  { label: 'Tue 21', sub: 'Jul' },
  { label: 'Wed 22', sub: 'Jul' },
  { label: 'Thu 23', sub: 'Jul' },
  { label: 'Fri 24', sub: 'Jul' },
];

const GRID_COLUMNS = '150px repeat(5, minmax(120px, 1fr)) 90px';
const GRID_MIN_WIDTH = 840;

interface Block {
  hours: string;
  label: string;
  bg: string;
  fg: string;
}

interface WorkloadCell {
  blocks: Block[];
  over?: boolean;
}

interface WorkloadMember {
  name: string;
  initial: string;
  avatarBg: string;
  days: WorkloadCell[];
  util: number;
  free: string;
}

const MEMBERS: WorkloadMember[] = [
  {
    name: 'Alex Morgan',
    initial: 'A',
    avatarBg: '#1677ff',
    days: [
      { blocks: [{ hours: '3.5h', label: 'Sprint work', ...CHIP_COLORS.green }] },
      { blocks: [{ hours: '2h', label: 'Reviews', ...CHIP_COLORS.yellow }] },
      { blocks: [{ hours: '4h', label: 'Feature build', ...CHIP_COLORS.blue }] },
      { blocks: [{ hours: '1h', label: 'Standup follow-up', ...CHIP_COLORS.gray }] },
      { blocks: [{ hours: '2h', label: 'Retro', ...CHIP_COLORS.green }] },
    ],
    util: 24,
    free: '30.5h free',
  },
  {
    name: 'Priya Nair',
    initial: 'P',
    avatarBg: '#722ed1',
    days: [
      { blocks: [{ hours: '2h', label: 'Backlog groom', ...CHIP_COLORS.blue }] },
      { blocks: [{ hours: '3h', label: 'Design QA', ...CHIP_COLORS.yellow }] },
      { blocks: [{ hours: '3h', label: 'Design QA', ...CHIP_COLORS.yellow }] },
      {
        blocks: [
          { hours: '5h', label: 'Feature build', ...CHIP_COLORS.purple },
          { hours: '2h', label: 'Backlog groom', ...CHIP_COLORS.blue },
        ],
      },
      { blocks: [{ hours: '11.5h', label: 'Release push', ...CHIP_COLORS.gray }], over: true },
    ],
    util: 29,
    free: '28.5h free',
  },
  {
    name: 'Daniel Reyes',
    initial: 'D',
    avatarBg: '#13c2c2',
    days: [
      { blocks: [{ hours: '4.5h', label: 'Migration', ...CHIP_COLORS.blue }] },
      { blocks: [{ hours: '3h', label: 'Vendor Call', ...CHIP_COLORS.green }] },
      { blocks: [{ hours: '2h', label: 'Route Planning', ...CHIP_COLORS.green }] },
      { blocks: [{ hours: '8h', label: 'Deployment', ...CHIP_COLORS.yellow }] },
      { blocks: [{ hours: '3h', label: 'On-call', ...CHIP_COLORS.gray }] },
    ],
    util: 31,
    free: '27.5h free',
  },
  {
    name: 'Liam Carter',
    initial: 'L',
    avatarBg: '#fa8c16',
    days: [
      { blocks: [{ hours: '2.5h', label: 'Design Handoff', ...CHIP_COLORS.purple }] },
      { blocks: [{ hours: '3h', label: 'Inventory Audit', ...CHIP_COLORS.green }] },
      { blocks: [] },
      { blocks: [{ hours: '4h', label: 'Vendor Call', ...CHIP_COLORS.blue }] },
      { blocks: [] },
    ],
    util: 12,
    free: '35h free',
  },
  {
    name: 'Sofia Marchetti',
    initial: 'S',
    avatarBg: '#eb2f96',
    days: [
      { blocks: [{ hours: '6h', label: 'Brand assets', ...CHIP_COLORS.blue }] },
      { blocks: [{ hours: '1h', label: 'Sync', ...CHIP_COLORS.yellow }] },
      { blocks: [] },
      { blocks: [] },
      { blocks: [{ hours: '11.5h', label: 'Campaign push', ...CHIP_COLORS.gray }], over: true },
    ],
    util: 18,
    free: '33h free',
  },
  {
    name: 'Noah Bennett',
    initial: 'N',
    avatarBg: '#2f54eb',
    days: [
      { blocks: [{ hours: '4h', label: 'Bug Bash', ...CHIP_COLORS.yellow }] },
      { blocks: [{ hours: '4h', label: 'Bug Bash', ...CHIP_COLORS.yellow }] },
      { blocks: [{ hours: '6h', label: 'Checkout Flow', ...CHIP_COLORS.blue }] },
      { blocks: [{ hours: '6h', label: 'Checkout Flow', ...CHIP_COLORS.blue }] },
      { blocks: [{ hours: '3h', label: 'Regression', ...CHIP_COLORS.green }] },
    ],
    util: 36,
    free: '25.5h free',
  },
  {
    name: 'Elena Cruz',
    initial: 'E',
    avatarBg: '#fa541c',
    days: [
      { blocks: [{ hours: '3h', label: 'Client Workshop', ...CHIP_COLORS.purple }] },
      { blocks: [{ hours: '2.5h', label: 'Proposal Draft', ...CHIP_COLORS.gray }] },
      { blocks: [] },
      { blocks: [{ hours: '5h', label: 'Onsite Visit', ...CHIP_COLORS.blue }] },
      { blocks: [{ hours: '2h', label: 'Follow-up Calls', ...CHIP_COLORS.yellow }] },
    ],
    util: 16,
    free: '34h free',
  },
  {
    name: 'Marcus Chen',
    initial: 'M',
    avatarBg: '#13c2c2',
    days: [
      { blocks: [{ hours: '4h', label: 'Infra Migration', ...CHIP_COLORS.green }] },
      { blocks: [{ hours: '4h', label: 'Infra Migration', ...CHIP_COLORS.green }] },
      { blocks: [] },
      { blocks: [{ hours: '4h', label: 'On-call', ...CHIP_COLORS.gray }] },
      { blocks: [{ hours: '6h', label: 'Perf Tuning', ...CHIP_COLORS.blue }] },
    ],
    util: 22,
    free: '31h free',
  },
];

const TEAM_TOTAL = { perDay: ['24h', '20.5h', '15.1h', '30h', '31.5h'], util: 22, free: '246.5h' };

const PlannerWorkloadPreviewMockup: React.FC = () => {
  const { token } = useToken();
  const border = `1px solid ${token.colorBorderSecondary}`;
  const { t } = useTranslation(['upgrade-preview', 'schedule']);
  const tc = (key: string, defaultValue: string) =>
    t(`plannerMockup.chrome.${key}`, { defaultValue, ns: 'upgrade-preview' });
  const tw = (key: string, defaultValue: string) => t(`plannerMockup.workload.${key}`, { defaultValue, ns: 'upgrade-preview' });

  const FILTERS = [
    tc('projectStatus', 'Project Status'),
    tc('projectPriority', 'Project Priority'),
    t('utilization', { ns: 'schedule', defaultValue: 'Utilization' }),
  ];

  return (
    <Flex vertical gap={12} style={{ height: '100%', minHeight: 0 }}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
        <Flex gap={12} align="center">
          <ViewToggleGroup options={[tc('membersOption', 'Members'), tc('projectsOption', 'Projects')]} active={tc('membersOption', 'Members')} />
          <Flex gap={8} wrap="wrap">
            {FILTERS.map(f => (
              <FilterPill key={f} label={f} />
            ))}
          </Flex>
        </Flex>
        <Flex gap={12} align="center">
          <Flex align="center" gap={4}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: token.colorPrimary }} />
            <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>{tc('taskLegend', 'Task')}</Text>
          </Flex>
          <Flex align="center" gap={4}>
            <div style={{ width: 10, height: 10, borderRadius: 2, border: `1px solid ${token.colorTextTertiary}` }} />
            <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>{tc('projectBlockLegend', 'Project block')}</Text>
          </Flex>
        </Flex>
      </Flex>

      <DateNavRow
        label="Jul 20 - 24, 2026"
        viewOptions={[tc('dayOption', 'Day'), tc('weekOption', 'Week'), tc('monthOption', 'Month')]}
        activeView={tc('weekOption', 'Week')}
      />

      <Card
        style={{ flex: 1, minHeight: 0 }}
        styles={{
          body: {
            padding: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          },
        }}
      >
        {/* Scrollable header + member rows */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <div style={{ minWidth: GRID_MIN_WIDTH, display: 'grid', gridTemplateColumns: GRID_COLUMNS }}>
            <div style={{ borderBottom: border }} />
            {DAYS.map(d => (
              <div
                key={d.label}
                style={{
                  padding: '10px 12px',
                  textAlign: 'center',
                  borderBottom: border,
                  borderLeft: border,
                }}
              >
                <Text strong style={{ fontSize: 12 }}>
                  {d.label}
                </Text>
                <div style={{ fontSize: 11, color: token.colorTextTertiary }}>{d.sub}</div>
              </div>
            ))}
            <div
              style={{
                padding: '10px 12px',
                textAlign: 'center',
                borderBottom: border,
                borderLeft: border,
                fontSize: 11,
                fontWeight: 600,
                color: token.colorTextTertiary,
              }}
            >
              {tw('utilColumn', 'UTIL')}
            </div>

            {MEMBERS.map(m => (
              <React.Fragment key={m.name}>
                <div
                  style={{
                    padding: '10px 12px',
                    borderBottom: border,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Avatar size={28} style={{ background: m.avatarBg, flexShrink: 0 }}>
                    {m.initial}
                  </Avatar>
                  <Text style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.name}
                  </Text>
                </div>
                {m.days.map((cell, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'relative',
                      padding: 8,
                      borderBottom: border,
                      borderLeft: border,
                      background: cell.over ? HIGHLIGHT_TINTS.over.body : undefined,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      minHeight: 60,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 6,
                        fontSize: 11,
                        color: token.colorTextQuaternary,
                      }}
                    >
                      +
                    </div>
                    {cell.blocks.map((b, bi) => (
                      <div key={bi} style={{ background: b.bg, borderRadius: 4, padding: '4px 8px' }}>
                        <Text style={{ fontSize: 11, color: b.fg, fontWeight: 600 }}>
                          {b.hours} <span style={{ fontWeight: 400 }}>{b.label}</span>
                        </Text>
                      </div>
                    ))}
                  </div>
                ))}
                <div
                  style={{
                    padding: '10px 12px',
                    borderBottom: border,
                    borderLeft: border,
                    textAlign: 'center',
                  }}
                >
                  <Text strong style={{ fontSize: 13, color: token.colorSuccess }}>
                    {m.util}%
                  </Text>
                  <div style={{ fontSize: 10, color: token.colorTextTertiary }}>{m.free}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Team Total row, pinned to the bottom of the content area */}
        <div style={{ flexShrink: 0, overflowX: 'auto', borderTop: border }}>
          <div style={{ minWidth: GRID_MIN_WIDTH, display: 'grid', gridTemplateColumns: GRID_COLUMNS }}>
            <div style={{ padding: '10px 12px', background: HIGHLIGHT_TINTS.footer }}>
              <Text strong style={{ fontSize: 12 }}>
                {tw('teamTotalRow', 'Team Total')}
              </Text>
            </div>
            {TEAM_TOTAL.perDay.map((total, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 12px',
                  borderLeft: border,
                  background: HIGHLIGHT_TINTS.footer,
                  textAlign: 'center',
                }}
              >
                <Text strong style={{ fontSize: 12 }}>
                  {total}
                </Text>
              </div>
            ))}
            <div
              style={{
                padding: '10px 12px',
                borderLeft: border,
                background: HIGHLIGHT_TINTS.footer,
                textAlign: 'center',
              }}
            >
              <Text strong style={{ fontSize: 13, color: token.colorSuccess }}>
                {TEAM_TOTAL.util}%
              </Text>
              <div style={{ fontSize: 10, color: token.colorTextTertiary }}>{TEAM_TOTAL.free}</div>
            </div>
          </div>
        </div>
      </Card>
    </Flex>
  );
};

export default PlannerWorkloadPreviewMockup;
