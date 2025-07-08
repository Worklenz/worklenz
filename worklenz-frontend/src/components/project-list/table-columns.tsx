// TableColumns.tsx
import { ColumnsType } from 'antd/es/table';
import {
  Avatar,
  Badge,
  Button,
  Flex,
  Progress,
  Rate,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CalendarOutlined,
  InboxOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next'; // Assuming you're using i18next for translations
import './TableColumns.css';
import { useNavigate } from 'react-router-dom';

import { useAppDispatch } from '../../hooks/useAppDispatch';
import { toggleUpdatedrawer } from '@/features/projects/project-slice';

interface DataType {
  key: string;
  name: string;
  client: string;
  category: string;
  status: string;
  totalTasks: number;
  completedTasks: number;
  lastUpdated: Date;
  startDate: Date | null;
  endDate: Date | null;
  members: string[];
}

const avatarColors = ['#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#87d068'];

const TableColumns = (): ColumnsType<DataType> => {
  const { t } = useTranslation('allProjectList'); // Use translation hook if you're using i18next
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return [
    {
      title: t('name'),
      // dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.length - b.name.length,
      onCell: (record) => {
        return {
          style: {
            cursor: 'pointer',
          },
        };
      },
      width: 240,
      showSorterTooltip: false,
      render: (text, record) => {
        // Format the start and end dates
        const formattedStartDate = record.startDate
          ? new Date(record.startDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : 'N/A';

        const formattedEndDate = record.endDate
          ? new Date(record.endDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : 'N/A';

        return (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Rate
              count={1}
              style={{ marginRight: '0.5rem', zIndex: 99 }}
              tooltips={['Add to favourites']}
            />
            <Flex
              gap={2}
              align="center"
              onClick={() => navigate(`/worklenz/projects/${record.key}`)}
            >
              <Badge color="geekblue" style={{ marginRight: '0.5rem' }} />
              <>
                <Typography.Text ellipsis={{ expanded: false }}>
                  {record.name}
                </Typography.Text>
                {(record.startDate || record.endDate) && (
                  <Tooltip
                    title={`Start date: ${formattedStartDate}\nEnd date: ${formattedEndDate}`}
                    overlayStyle={{ width: '200px' }}
                  >
                    <CalendarOutlined style={{ marginLeft: '0.5rem' }} />
                  </Tooltip>
                )}
              </>
            </Flex>
          </div>
        );
      },
    },
    {
      title: t('client'),
      dataIndex: 'client',
      key: 'client',
      sorter: (a, b) => a.client.length - b.client.length,
      showSorterTooltip: false,
    },
    {
      title: t('category'),
      dataIndex: 'category',
      key: 'category',
      render: (category) =>
        category === '-' ? (
          <>{category}</>
        ) : (
          <Tooltip title={`Click to filter by "${category}"`}>
            <Tag
              color="#ff9c3c"
              style={{ borderRadius: '50rem' }}
              className="table-tag"
            >
              {category}
            </Tag>
          </Tooltip>
        ),
      sorter: (a, b) => a.category.length - b.category.length,
      showSorterTooltip: false,
      filters: [
        {
          text: 'Category 1',
          value: 'Category 1',
        },
        {
          text: 'Category 2',
          value: 'Category 2',
        },
      ],
      onFilter: (value, record) => record.category.startsWith(value as string),
    },
    {
      title: t('status'),
      key: 'status',
      dataIndex: 'status',
      sorter: (a, b) => a.status.length - b.status.length,
      showSorterTooltip: false,
      filters: [
        {
          text: 'Cancelled',
          value: 'Cancelled',
        },
        {
          text: 'Blocked',
          value: 'Blocked',
        },
        {
          text: 'On Hold',
          value: 'On Hold',
        },
        {
          text: 'Proposed',
          value: 'Proposed',
        },
        {
          text: 'In Planning',
          value: 'In Planning',
        },
        {
          text: 'In Progress',
          value: 'In Progress',
        },
        {
          text: 'Completed',
          value: 'Completed',
        },
        {
          text: 'Continous',
          value: 'Continous',
        },
      ],
      onFilter: (value, record) => record.status.startsWith(value as string),
    },
    {
      title: t('tasksProgress'),
      key: 'tasksProgress',
      dataIndex: 'tasksProgress',
      render: (text, record) => {
        const { totalTasks, completedTasks } = record;
        const percent =
          totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        return (
          <Tooltip title={`${completedTasks} / ${totalTasks} tasks completed.`}>
            <Progress percent={percent} className="project-progress" />
          </Tooltip>
        );
      },
    },
    {
      title: t('lastUpdated'),
      key: 'lastUpdated',
      dataIndex: 'lastUpdated',
      width: 160,
      sorter: (a, b) =>
        new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime(),
      showSorterTooltip: false,
      render: (date: Date) => {
        const now = new Date();
        const updatedDate = new Date(date);

        const timeDifference = now.getTime() - updatedDate.getTime();
        const minuteInMs = 60 * 1000;
        const hourInMs = 60 * minuteInMs;
        const dayInMs = 24 * hourInMs;

        let displayText = '';

        if (timeDifference < hourInMs) {
          const minutesAgo = Math.floor(timeDifference / minuteInMs);
          displayText = `${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`;
        } else if (timeDifference < dayInMs) {
          const hoursAgo = Math.floor(timeDifference / hourInMs);
          displayText = `${hoursAgo} hour${hoursAgo === 1 ? '' : 's'} ago`;
        } else if (timeDifference < 7 * dayInMs) {
          const daysAgo = Math.floor(timeDifference / dayInMs);
          displayText = `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
        } else {
          displayText = updatedDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        }

        return (
          <>
            <Tooltip
              title={updatedDate.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                hour12: true,
              })}
            >
              {displayText}
            </Tooltip>
          </>
        );
      },
    },
    {
      title: t('members'),
      key: 'members',
      dataIndex: 'members',
      render: (members: string[]) => (
        <Avatar.Group>
          {members.map((member, index) => (
            <Tooltip key={index} title={member}>
              <Avatar
                style={{
                  backgroundColor: avatarColors[index % avatarColors.length],
                  width: '28px',
                  height: '28px',
                  border: 'none',
                }}
              >
                {member.charAt(0).toUpperCase()}
              </Avatar>
            </Tooltip>
          ))}
        </Avatar.Group>
      ),
    },
    {
      title: '',
      key: 'button',
      dataIndex: '',
      render: (render) => (
        <div className="hover-button">
          <Tooltip title={t('setting')}>
            <Button
              onClick={() => dispatch(toggleUpdatedrawer(render.id))}
              style={{ marginRight: '8px' }}
              size="small"
            >
              <SettingOutlined />
            </Button>
          </Tooltip>

          <Tooltip title={t('archive')}>
            <Button size="small">
              <InboxOutlined />
            </Button>
          </Tooltip>
        </div>
      ),
    },
  ];
};

export default TableColumns;
