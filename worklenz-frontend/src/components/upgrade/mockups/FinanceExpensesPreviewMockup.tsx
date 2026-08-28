import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Flex, Typography, Table, Avatar, theme } from '@/shared/antd-imports';

const { useToken } = theme;
const { Title, Text } = Typography;

interface ExpenseRow {
  color: string;
  project: string;
  task: string;
  amount: string;
  assignees: { initial: string; bg: string }[];
  date: string;
}

// Fake project/task/amount data below stands in for real (untranslated) user
// data — only the surrounding UI chrome (labels, headers) is translated.
const EXPENSES: ExpenseRow[] = [
  { color: '#1677ff', project: 'Nimbus Retail Website', task: 'Server migration license', amount: '245.00 USD', assignees: [{ initial: 'A', bg: '#1677ff' }, { initial: 'P', bg: '#722ed1' }], date: 'Jul 21' },
  { color: '#faad14', project: 'Beacon Logistics App', task: 'Design software subscription', amount: '89.00 USD', assignees: [{ initial: 'D', bg: '#13c2c2' }], date: 'Jul 20' },
  { color: '#52c41a', project: 'Vertex Inventory System', task: 'Third-party API credits', amount: '312.50 USD', assignees: [{ initial: 'L', bg: '#fa8c16' }, { initial: 'S', bg: '#eb2f96' }], date: 'Jul 19' },
  { color: '#722ed1', project: 'Northwind Studio Refresh', task: 'Stock photography license', amount: '58.00 USD', assignees: [{ initial: 'E', bg: '#fa541c' }], date: 'Jul 18' },
  { color: '#ff4d4f', project: 'Solace Patient Portal', task: 'Compliance audit fee', amount: '420.00 USD', assignees: [{ initial: 'N', bg: '#2f54eb' }, { initial: 'M', bg: '#13c2c2' }], date: 'Jul 17' },
  { color: '#13c2c2', project: 'Mobile App Revamp', task: 'App store developer fee', amount: '99.00 USD', assignees: [{ initial: 'A', bg: '#1677ff' }], date: 'Jul 16' },
];

const FinanceExpensesPreviewMockup: React.FC = () => {
  const { token } = useToken();
  const { t } = useTranslation('upgrade-preview');
  const tp = (key: string, defaultValue: string) => t(`financeMockups.expenses.${key}`, { defaultValue });

  const columns = [
    {
      title: tp('projectColumn', 'Project'),
      dataIndex: 'project',
      width: '22%',
      render: (name: string, row: ExpenseRow) => (
        <Flex align="center" gap={6}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 13, fontWeight: 500 }}>{name}</Text>
        </Flex>
      ),
    },
    { title: tp('taskColumn', 'Task'), dataIndex: 'task', width: '28%' },
    {
      title: tp('amountColumn', 'Amount'),
      dataIndex: 'amount',
      width: '18%',
      render: (v: string) => <Text style={{ fontWeight: 600 }}>{v}</Text>,
    },
    {
      title: tp('assigneeColumn', 'Assignee'),
      dataIndex: 'assignees',
      width: '18%',
      render: (assignees: ExpenseRow['assignees']) => (
        <Flex>
          {assignees.map((a, i) => (
            <Avatar
              key={i}
              size={24}
              style={{ background: a.bg, marginLeft: i === 0 ? 0 : -8, border: `2px solid ${token.colorBgContainer}` }}
            >
              {a.initial}
            </Avatar>
          ))}
        </Flex>
      ),
    },
    { title: tp('dateColumn', 'Date'), dataIndex: 'date', width: '14%' },
  ];

  return (
    <Flex vertical gap={16}>
      <div>
        <Title level={4} style={{ margin: 0 }}>
          {tp('pageTitle', 'Project Expenses')}
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {tp('pageSubtitle', 'All fixed costs added to project tasks across your team.')}
        </Text>
      </div>

      <Card styles={{ body: { padding: 20 } }}>
        <Table columns={columns} dataSource={EXPENSES} rowKey="task" pagination={false} size="middle" />

        <Flex
          justify="space-between"
          align="center"
          wrap="wrap"
          gap={8}
          style={{ paddingTop: 16, marginTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}` }}
        >
          <Flex align="center" gap={8}>
            <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
              {t('financeMockups.expenses.rowsPerPage', { defaultValue: 'Rows per page: {{count}}', count: 10 })}
            </Text>
            <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>1–6 of 42</Text>
          </Flex>
          <Flex align="center" gap={4}>
            <Text style={{ fontSize: 12 }}>‹</Text>
            <Text style={{ fontSize: 12 }}>1 / 5</Text>
            <Text style={{ fontSize: 12 }}>›</Text>
          </Flex>
        </Flex>
      </Card>
    </Flex>
  );
};

export default FinanceExpensesPreviewMockup;
