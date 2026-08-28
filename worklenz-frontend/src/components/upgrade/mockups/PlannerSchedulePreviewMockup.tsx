import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Flex, Typography, theme, Avatar } from '@/shared/antd-imports';
import { FilterPill, DateNavRow, CHIP_COLORS, HIGHLIGHT_TINTS } from './PlannerMockupChrome';

const { useToken } = theme;
const { Text } = Typography;

const DAYS = [
  { label: 'Mon 20', sub: 'Jul', today: false },
  { label: 'Tue 21', sub: 'Jul', today: false },
  { label: 'Wed 22', sub: 'Jul', today: false },
  { label: 'Thu 23', sub: 'Jul', today: true },
  { label: 'Fri 24', sub: 'Jul', today: false },
];

const GRID_COLUMNS = '160px repeat(5, minmax(130px, 1fr))';
const GRID_MIN_WIDTH = 810;

interface Block {
  hours: string;
  label: string;
  sub: string;
  bg: string;
  fg: string;
}

interface DayCell {
  blocks: Block[];
  total: string;
  over?: boolean;
}

interface MemberRow {
  name: string;
  initial: string;
  avatarBg: string;
  total: string;
  days: DayCell[];
}

const MEMBERS: MemberRow[] = [
  {
    name: 'Alex Morgan',
    initial: 'A',
    avatarBg: '#1677ff',
    total: '26h 30min',
    days: [
      { blocks: [{ hours: '2.0h', label: 'Onboarding Flow', sub: 'Design', ...CHIP_COLORS.green }], total: '2.0' },
      { blocks: [{ hours: '3.5h', label: 'Sprint Planning', sub: 'Reporting', ...CHIP_COLORS.blue }], total: '3.5' },
      { blocks: [{ hours: '4.0h', label: 'Dashboard Redesign', sub: 'UI', ...CHIP_COLORS.purple }], total: '4.0' },
      { blocks: [{ hours: '6.0h', label: 'API Integration', sub: 'Billing', ...CHIP_COLORS.blue }], total: '6.0' },
      { blocks: [{ hours: '5.0h', label: 'QA Pass', sub: 'Release', ...CHIP_COLORS.yellow }], total: '5.0' },
    ],
  },
  {
    name: 'Priya Nair',
    initial: 'P',
    avatarBg: '#722ed1',
    total: '31h 30min',
    days: [
      { blocks: [{ hours: '3.0h', label: 'Client Sync', sub: 'Nimbus', ...CHIP_COLORS.green }], total: '3.0' },
      { blocks: [{ hours: '4.5h', label: 'Data Migration', sub: 'Backend', ...CHIP_COLORS.blue }], total: '4.5' },
      { blocks: [{ hours: '2.0h', label: 'Code Review', sub: 'PR #128', ...CHIP_COLORS.yellow }], total: '2.0' },
      {
        blocks: [
          { hours: '5.5h', label: 'Feature Build', sub: 'Timeline', ...CHIP_COLORS.purple },
          { hours: '4.0h', label: 'Bug Triage', sub: 'Sprint 4', ...CHIP_COLORS.gray },
        ],
        total: '9.5',
        over: true,
      },
      { blocks: [{ hours: '3.5h', label: 'Retro Prep', sub: 'Planning', ...CHIP_COLORS.green }], total: '3.5' },
    ],
  },
  {
    name: 'Daniel Reyes',
    initial: 'D',
    avatarBg: '#13c2c2',
    total: '20h 00min',
    days: [
      { blocks: [{ hours: '2.0h', label: 'Standup Prep', sub: 'Ops', ...CHIP_COLORS.gray }], total: '2.0' },
      { blocks: [{ hours: '4.0h', label: 'Warehouse Sync', sub: 'Logistics', ...CHIP_COLORS.blue }], total: '4.0' },
      { blocks: [{ hours: '4.0h', label: 'Warehouse Sync', sub: 'Logistics', ...CHIP_COLORS.blue }], total: '4.0' },
      { blocks: [{ hours: '4.0h', label: 'Route Planning', sub: 'Ops', ...CHIP_COLORS.green }], total: '4.0' },
      { blocks: [{ hours: '8.0h', label: 'Deployment', sub: 'Release', ...CHIP_COLORS.yellow }], total: '8.0' },
    ],
  },
  {
    name: 'Liam Carter',
    initial: 'L',
    avatarBg: '#fa8c16',
    total: '30h 30min',
    days: [
      { blocks: [{ hours: '2.5h', label: 'Design Handoff', sub: 'UI Kit', ...CHIP_COLORS.purple }], total: '2.5' },
      { blocks: [{ hours: '3.0h', label: 'Inventory Audit', sub: 'Vertex', ...CHIP_COLORS.green }], total: '3.0' },
      { blocks: [{ hours: '3.0h', label: 'Vendor Call', sub: 'Ops', ...CHIP_COLORS.blue }], total: '3.0' },
      { blocks: [{ hours: '4.0h', label: 'Vendor Call', sub: 'Ops', ...CHIP_COLORS.blue }], total: '4.0' },
      { blocks: [{ hours: '11.5h', label: 'Launch Prep', sub: 'Overtime', ...CHIP_COLORS.gray }], total: '11.5', over: true },
    ],
  },
  {
    name: 'Sofia Marchetti',
    initial: 'S',
    avatarBg: '#eb2f96',
    total: '19h 00min',
    days: [
      { blocks: [{ hours: '3.0h', label: 'Content Review', sub: 'Blog', ...CHIP_COLORS.yellow }], total: '3.0' },
      { blocks: [{ hours: '4.0h', label: 'Brand Assets', sub: 'Design', ...CHIP_COLORS.purple }], total: '4.0' },
      { blocks: [{ hours: '5.0h', label: 'Brand Assets', sub: 'Design', ...CHIP_COLORS.purple }], total: '5.0' },
      { blocks: [{ hours: '4.0h', label: 'Social Calendar', sub: 'Marketing', ...CHIP_COLORS.green }], total: '4.0' },
      { blocks: [{ hours: '3.0h', label: 'Newsletter', sub: 'Draft', ...CHIP_COLORS.blue }], total: '3.0' },
    ],
  },
  {
    name: 'Noah Bennett',
    initial: 'N',
    avatarBg: '#2f54eb',
    total: '28h 00min',
    days: [
      { blocks: [{ hours: '4.0h', label: 'Bug Bash', sub: 'QA', ...CHIP_COLORS.yellow }], total: '4.0' },
      { blocks: [{ hours: '4.0h', label: 'Bug Bash', sub: 'QA', ...CHIP_COLORS.yellow }], total: '4.0' },
      { blocks: [{ hours: '6.0h', label: 'Checkout Flow', sub: 'Nimbus', ...CHIP_COLORS.blue }], total: '6.0' },
      { blocks: [{ hours: '6.0h', label: 'Checkout Flow', sub: 'Nimbus', ...CHIP_COLORS.blue }], total: '6.0' },
      { blocks: [{ hours: '8.0h', label: 'Release Regression', sub: 'QA', ...CHIP_COLORS.green }], total: '8.0' },
    ],
  },
  {
    name: 'Elena Cruz',
    initial: 'E',
    avatarBg: '#fa541c',
    total: '24h 30min',
    days: [
      { blocks: [{ hours: '3.0h', label: 'Client Workshop', sub: 'Beacon', ...CHIP_COLORS.purple }], total: '3.0' },
      { blocks: [{ hours: '2.5h', label: 'Proposal Draft', sub: 'Sales', ...CHIP_COLORS.gray }], total: '2.5' },
      { blocks: [{ hours: '5.0h', label: 'Onsite Visit', sub: 'Beacon', ...CHIP_COLORS.blue }], total: '5.0' },
      { blocks: [{ hours: '6.0h', label: 'Onsite Visit', sub: 'Beacon', ...CHIP_COLORS.blue }], total: '6.0' },
      { blocks: [{ hours: '8.0h', label: 'Follow-up Calls', sub: 'Sales', ...CHIP_COLORS.yellow }], total: '8.0' },
    ],
  },
  {
    name: 'Marcus Chen',
    initial: 'M',
    avatarBg: '#13c2c2',
    total: '22h 00min',
    days: [
      { blocks: [{ hours: '4.0h', label: 'Infra Migration', sub: 'Platform', ...CHIP_COLORS.green }], total: '4.0' },
      { blocks: [{ hours: '4.0h', label: 'Infra Migration', sub: 'Platform', ...CHIP_COLORS.green }], total: '4.0' },
      { blocks: [{ hours: '4.0h', label: 'On-call', sub: 'Support', ...CHIP_COLORS.gray }], total: '4.0' },
      { blocks: [{ hours: '4.0h', label: 'On-call', sub: 'Support', ...CHIP_COLORS.gray }], total: '4.0' },
      { blocks: [{ hours: '6.0h', label: 'Perf Tuning', sub: 'Platform', ...CHIP_COLORS.blue }], total: '6.0' },
    ],
  },
];

const PlannerSchedulePreviewMockup: React.FC = () => {
  const { token } = useToken();
  const border = `1px solid ${token.colorBorderSecondary}`;
  const { t } = useTranslation(['upgrade-preview', 'schedule']);
  const tc = (key: string, defaultValue: string) =>
    t(`plannerMockup.chrome.${key}`, { defaultValue, ns: 'upgrade-preview' });
  const ts = (key: string, defaultValue: string) => t(`plannerMockup.schedule.${key}`, { defaultValue, ns: 'upgrade-preview' });

  const FILTERS = [
    t('allRoles', { ns: 'schedule', defaultValue: 'Role: All roles' }),
    t('allMembers', { ns: 'schedule', defaultValue: 'All members' }),
    t('allProjects', { ns: 'schedule', defaultValue: 'All projects' }),
    t('allClients', { ns: 'schedule', defaultValue: 'All clients' }),
    t('status', { ns: 'schedule', defaultValue: 'Status' }),
    tc('priority', 'Priority'),
    t('utilization', { ns: 'schedule', defaultValue: 'Utilization' }),
  ];

  return (
    <Flex vertical gap={12} style={{ height: '100%', minHeight: 0 }}>
      <Flex gap={8} wrap="wrap">
        {FILTERS.map(f => (
          <FilterPill key={f} label={f} />
        ))}
      </Flex>

      <DateNavRow
        label="July 2026, Week 30"
        viewOptions={[tc('daysOption', 'Days'), tc('weeksOption', 'Weeks'), tc('monthsOption', 'Months')]}
        activeView={tc('daysOption', 'Days')}
      />

      <Card
        style={{ flex: 1, minHeight: 0 }}
        styles={{ body: { padding: 0, height: '100%', overflow: 'auto' } }}
      >
        <div style={{ minWidth: GRID_MIN_WIDTH }}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID_COLUMNS }}>
            <div
              style={{
                padding: '10px 12px',
                fontSize: 11,
                fontWeight: 600,
                color: token.colorTextTertiary,
                borderBottom: border,
              }}
            >
              {ts('memberColumn', 'Member').toUpperCase()}
            </div>
            {DAYS.map(d => (
              <div
                key={d.label}
                style={{
                  padding: '10px 12px',
                  textAlign: 'center',
                  borderBottom: border,
                  borderLeft: border,
                  background: d.today ? HIGHLIGHT_TINTS.today.header : undefined,
                }}
              >
                <Text strong style={{ fontSize: 12, color: d.today ? HIGHLIGHT_TINTS.today.text : undefined }}>
                  {d.label}
                </Text>
                <div style={{ fontSize: 11, color: token.colorTextTertiary }}>{d.sub}</div>
              </div>
            ))}

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
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.name}
                    </div>
                    <div style={{ fontSize: 11, color: token.colorTextTertiary }}>{m.total}</div>
                  </div>
                </div>
                {m.days.map((cell, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 8,
                      borderBottom: border,
                      borderLeft: border,
                      background: cell.over
                        ? HIGHLIGHT_TINTS.over.body
                        : DAYS[i].today
                          ? HIGHLIGHT_TINTS.today.body
                          : undefined,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      minHeight: 66,
                    }}
                  >
                    {cell.blocks.map((b, bi) => (
                      <div key={bi} style={{ background: b.bg, borderRadius: 4, padding: '4px 8px' }}>
                        <Text style={{ fontSize: 11, color: b.fg, fontWeight: 600 }}>
                          {b.hours} <span style={{ fontWeight: 400 }}>{b.label}</span>
                        </Text>
                        <div style={{ fontSize: 10, color: b.fg, opacity: 0.8 }}>{b.sub}</div>
                      </div>
                    ))}
                    <Text
                      style={{
                        fontSize: 10,
                        color: cell.over ? HIGHLIGHT_TINTS.over.text : token.colorTextQuaternary,
                        marginTop: 'auto',
                        textAlign: 'right',
                      }}
                    >
                      {cell.total} / 8.00h
                    </Text>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Card>
    </Flex>
  );
};

export default PlannerSchedulePreviewMockup;
