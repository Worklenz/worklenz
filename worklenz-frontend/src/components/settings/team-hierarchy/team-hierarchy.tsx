import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Card, Typography, Spin, Alert, Avatar, Tag, Space, Tooltip, Row, Col, Divider, Badge, Empty, Flex, theme } from '@/shared/antd-imports';
import { UserOutlined, TeamOutlined, CrownOutlined, UsergroupAddOutlined, UserSwitchOutlined, MailOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { teamManagementApiService } from '@/api/team-management/team-management.api.service';
import { getRoleColor } from '@/types/roles/role.types';

const { Title, Text } = Typography;

interface TeamMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role_name: string;
  reports_to_member_id?: string;
  level: number;
  hierarchy_path: string;
}

interface HierarchyGroup {
  teamLead: TeamMember | null;
  directReports: TeamMember[];
  indirectReports: TeamMember[];
}

const TeamHierarchy: React.FC = () => {
  const { t } = useTranslation('settings/team-members');
  const { token } = theme.useToken();
  const [hierarchyData, setHierarchyData] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detect dark mode
  const isDarkMode = useMemo(
    () =>
      token.colorBgContainer === '#1f1f1f' ||
      token.colorBgBase === '#141414' ||
      token.colorBgElevated === '#1f1f1f' ||
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      document.body.classList.contains('dark'),
    [token]
  );

  const fetchHierarchy = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await teamManagementApiService.getTeamHierarchy();
      
      if (response.done && response.body) {
        setHierarchyData(response.body);
      } else {
        setError('Failed to fetch team hierarchy');
      }
    } catch (err) {
      console.error('Error fetching team hierarchy:', err);
      setError('Error loading team hierarchy');
    } finally {
      setLoading(false);
    }
  }, []);

  const organizeHierarchy = useCallback((members: TeamMember[]): HierarchyGroup[] => {
    const memberMap = new Map<string, TeamMember>();
    members.forEach(member => memberMap.set(member.id, member));

    // Get all team leads
    const teamLeads = members.filter(member => member.role_name === 'Team Lead');
    
    // Get unassigned members (no team lead)
    const unassignedMembers = members.filter(member => 
      !member.reports_to_member_id && 
      member.role_name !== 'Team Lead' && 
      member.role_name !== 'Owner' && 
      member.role_name !== 'Admin'
    );

    // Get leadership (Owner, Admin)
    const leadership = members.filter(member => 
      member.role_name === 'Owner' || member.role_name === 'Admin'
    );

    const groups: HierarchyGroup[] = [];

    // Add leadership group
    if (leadership.length > 0) {
      groups.push({
        teamLead: null,
        directReports: leadership,
        indirectReports: []
      });
    }

    // Add team lead groups
    teamLeads.forEach(teamLead => {
      const directReports = members.filter(member => 
        member.reports_to_member_id === teamLead.id &&
        member.role_name !== 'Team Lead' &&
        member.role_name !== 'Owner' &&
        member.role_name !== 'Admin'
      );
      
      const indirectReports = members.filter(member => {
        if (!member.reports_to_member_id) return false;
        if (member.role_name === 'Team Lead' || member.role_name === 'Owner' || member.role_name === 'Admin') return false;
        const manager = memberMap.get(member.reports_to_member_id);
        return manager && manager.reports_to_member_id === teamLead.id;
      });

      groups.push({
        teamLead,
        directReports,
        indirectReports
      });
    });

    // Add unassigned members group
    if (unassignedMembers.length > 0) {
      groups.push({
        teamLead: null,
        directReports: unassignedMembers,
        indirectReports: []
      });
    }

    return groups;
  }, []);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  const MemberCard: React.FC<{ member: TeamMember; isTeamLead?: boolean; isIndirect?: boolean }> = ({
    member,
    isTeamLead = false,
    isIndirect = false
  }) => {
    const cardStyle = useMemo(
      () => ({
        marginBottom: 4,
        border: isTeamLead
          ? `2px solid ${token.colorPrimary}`
          : isIndirect
          ? `1px dashed ${isDarkMode ? '#434343' : '#d9d9d9'}`
          : `1px solid ${isDarkMode ? '#303030' : '#f0f0f0'}`,
        backgroundColor: isTeamLead
          ? (isDarkMode ? '#162312' : '#f6ffed')
          : isIndirect
          ? (isDarkMode ? '#1a1a1a' : '#fafafa')
          : (isDarkMode ? '#1f1f1f' : '#ffffff')
      }),
      [isTeamLead, isIndirect, isDarkMode, token.colorPrimary]
    );

    return (
      <Card
        size="small"
        style={cardStyle}
        bodyStyle={{ padding: '8px' }}
      >
        <Flex align="center" gap={8}>
          <Avatar
            size={isTeamLead ? 'default' : 'small'}
            icon={<UserOutlined />}
            style={{
              backgroundColor: getRoleColor(member.role_name),
              flexShrink: 0
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Flex align="center" gap={6} wrap>
              <Text strong style={{ fontSize: isTeamLead ? '14px' : '13px' }}>
                {member.name}
              </Text>
              {isTeamLead && <CrownOutlined style={{ color: '#faad14', fontSize: '12px' }} />}
              <Tag color={getRoleColor(member.role_name)} size="small" style={{ margin: 0 }}>
                {member.role_name}
              </Tag>
            </Flex>
            <Flex align="center" gap={3} style={{ marginTop: 2 }}>
              <MailOutlined style={{ fontSize: '11px', color: isDarkMode ? '#8c8c8c' : '#8c8c8c' }} />
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {member.email}
              </Text>
            </Flex>
          </div>
        </Flex>
      </Card>
    );
  };

  const HierarchyGroupCard: React.FC<{ group: HierarchyGroup; title: string; icon: React.ReactNode }> = ({
    group,
    title,
    icon
  }) => {
    const headStyle = useMemo(
      () => ({
        backgroundColor: isDarkMode ? '#1a1a1a' : '#fafafa',
        padding: '8px 12px',
        minHeight: 'auto',
        borderBottom: `1px solid ${isDarkMode ? '#303030' : '#f0f0f0'}`
      }),
      [isDarkMode]
    );

    const cardStyle = useMemo(
      () => ({
        marginBottom: 12,
        backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
        border: `1px solid ${isDarkMode ? '#303030' : '#f0f0f0'}`
      }),
      [isDarkMode]
    );

    return (
      <Card
        title={
          <Space size="small">
            {icon}
            <span style={{ fontSize: '14px' }}>{title}</span>
            <Badge
              count={group.directReports.length + group.indirectReports.length}
              style={{ backgroundColor: '#52c41a' }}
              size="small"
            />
          </Space>
        }
        size="small"
        style={cardStyle}
        headStyle={headStyle}
        bodyStyle={{ padding: '8px' }}
      >
        {group.teamLead && (
          <>
            <MemberCard member={group.teamLead} isTeamLead />
            {(group.directReports.length > 0 || group.indirectReports.length > 0) && (
              <Divider orientation="left" orientationMargin={0} style={{ margin: '8px 0' }}>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  Reports to {group.teamLead.name}
                </Text>
              </Divider>
            )}
          </>
        )}

        {group.directReports.length > 0 && (
          <div style={{ marginBottom: group.indirectReports.length > 0 ? 8 : 0 }}>
            {group.directReports.map(member => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        )}

        {group.indirectReports.length > 0 && (
          <>
            <Divider orientation="left" orientationMargin={0} style={{ margin: '8px 0' }}>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                Indirect Reports
              </Text>
            </Divider>
            {group.indirectReports.map(member => (
              <MemberCard key={member.id} member={member} isIndirect />
            ))}
          </>
        )}

        {group.directReports.length === 0 && group.indirectReports.length === 0 && !group.teamLead && (
          <Empty
            description="No members in this group"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text>Loading team hierarchy...</Text>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          action={
            <button
              onClick={fetchHierarchy}
              style={{
                border: 'none',
                background: 'none',
                color: token.colorPrimary,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Retry
            </button>
          }
        />
      </Card>
    );
  }

  const hierarchyGroups = organizeHierarchy(hierarchyData);
  const totalMembers = hierarchyData.length;
  const teamLeadsCount = hierarchyData.filter(m => m.role_name === 'Team Lead').length;
  const assignedMembersCount = hierarchyData.filter(m => m.reports_to_member_id).length;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ marginBottom: 4 }}>
          <TeamOutlined /> Team Hierarchy
        </Title>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Organizational structure showing reporting relationships and team assignments
        </Text>
      </div>

      {/* Summary Stats */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            bodyStyle={{ padding: '8px' }}
            style={{
              backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
              border: `1px solid ${isDarkMode ? '#303030' : '#f0f0f0'}`
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: token.colorPrimary }}>
                {totalMembers}
              </div>
              <div style={{ color: isDarkMode ? '#8c8c8c' : '#8c8c8c', fontSize: '11px' }}>Total Members</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            bodyStyle={{ padding: '8px' }}
            style={{
              backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
              border: `1px solid ${isDarkMode ? '#303030' : '#f0f0f0'}`
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#52c41a' }}>
                {teamLeadsCount}
              </div>
              <div style={{ color: isDarkMode ? '#8c8c8c' : '#8c8c8c', fontSize: '11px' }}>Team Leads</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            bodyStyle={{ padding: '8px' }}
            style={{
              backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
              border: `1px solid ${isDarkMode ? '#303030' : '#f0f0f0'}`
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#faad14' }}>
                {assignedMembersCount}
              </div>
              <div style={{ color: isDarkMode ? '#8c8c8c' : '#8c8c8c', fontSize: '11px' }}>Assigned Members</div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Hierarchy Groups */}
      {hierarchyGroups.length > 0 ? (
        <div>
          {hierarchyGroups.map((group, index) => {
            let title = '';
            let icon = <TeamOutlined />;

            if (group.teamLead) {
              title = `${group.teamLead.name}'s Team`;
              icon = <UsergroupAddOutlined />;
            } else if (group.directReports.some(m => m.role_name === 'Owner' || m.role_name === 'Admin')) {
              title = 'Management';
              icon = <CrownOutlined />;
            } else {
              title = 'Unassigned Members';
              icon = <UserSwitchOutlined />;
            }

            return (
              <HierarchyGroupCard 
                key={index}
                group={group} 
                title={title} 
                icon={icon}
              />
            );
          })}
        </div>
      ) : (
        <Card
          style={{
            backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
            border: `1px solid ${isDarkMode ? '#303030' : '#f0f0f0'}`
          }}
        >
          <Empty
            image={<TeamOutlined style={{ fontSize: '64px', color: isDarkMode ? '#434343' : '#d9d9d9' }} />}
            description={
              <div>
                <Text type="secondary">No team hierarchy found</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Assign members to Team Leads to see the hierarchy here
                </Text>
              </div>
            }
          />
        </Card>
      )}
    </div>
  );
};

export default TeamHierarchy;