import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Input,
  Row,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  theme,
} from '@/shared/antd-imports';
import {
  CrownOutlined,
  MailOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
  UserSwitchOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
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
  title: string;
  titleKey: string;
  description: string;
  type: 'management' | 'team' | 'unassigned';
}

interface MemberCardProps {
  member: TeamMember;
  accentColor: string;
  badgeLabel: string;
  isTeamLead?: boolean;
  isIndirect?: boolean;
}

interface SummaryCardProps {
  icon: ReactNode;
  label: string;
  value: number;
  accentColor: string;
}

const LEADERSHIP_ROLES = new Set(['Owner', 'Admin']);
const TEAM_LEAD_ROLE = 'Team Lead';

const normalizeSearchValue = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const sortMembersByName = (members: TeamMember[]) =>
  [...members].sort((memberA, memberB) => memberA.name.localeCompare(memberB.name));

const TeamHierarchy = () => {
  const { t } = useTranslation('settings/team-members');
  const { token } = theme.useToken();
  const [hierarchyData, setHierarchyData] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');

  const fetchHierarchy = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await teamManagementApiService.getTeamHierarchy();

      if (response.done && response.body) {
        setHierarchyData(response.body);
        return;
      }

      setError(
        t('teamHierarchyLoadFailed', {
          defaultValue: 'Failed to fetch team hierarchy.',
        })
      );
    } catch (fetchError) {
      console.error('Error fetching team hierarchy:', fetchError);
      setError(
        t('teamHierarchyLoadError', {
          defaultValue: 'Something went wrong while loading the team hierarchy.',
        })
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  const organizeHierarchy = useCallback(
    (members: TeamMember[]): HierarchyGroup[] => {
      const memberMap = new Map<string, TeamMember>();
      members.forEach(member => memberMap.set(member.id, member));

      const leadership = sortMembersByName(
        members.filter(member => LEADERSHIP_ROLES.has(member.role_name))
      );

      const teamLeads = sortMembersByName(
        members.filter(member => member.role_name === TEAM_LEAD_ROLE)
      );

      const unassignedMembers = sortMembersByName(
        members.filter(
          member =>
            !member.reports_to_member_id &&
            member.role_name !== TEAM_LEAD_ROLE &&
            !LEADERSHIP_ROLES.has(member.role_name)
        )
      );

      const groups: HierarchyGroup[] = [];

      if (leadership.length > 0) {
        groups.push({
          teamLead: null,
          directReports: leadership,
          indirectReports: [],
          titleKey: 'teamHierarchyManagementTitle',
          title: t('teamHierarchyManagementTitle', { defaultValue: 'Management' }),
          description: t('teamHierarchyManagementDescription', {
            defaultValue: 'Owners and admins who oversee the workspace.',
          }),
          type: 'management',
        });
      }

      teamLeads.forEach(teamLead => {
        const directReports = sortMembersByName(
          members.filter(
            member =>
              member.reports_to_member_id === teamLead.id &&
              member.role_name !== TEAM_LEAD_ROLE &&
              !LEADERSHIP_ROLES.has(member.role_name)
          )
        );

        const indirectReports = sortMembersByName(
          members.filter(member => {
            if (!member.reports_to_member_id) {
              return false;
            }

            if (member.role_name === TEAM_LEAD_ROLE || LEADERSHIP_ROLES.has(member.role_name)) {
              return false;
            }

            const manager = memberMap.get(member.reports_to_member_id);
            return manager?.reports_to_member_id === teamLead.id;
          })
        );

        groups.push({
          teamLead,
          directReports,
          indirectReports,
          titleKey: 'teamHierarchyTeamTitle',
          title: t('teamHierarchyTeamTitle', {
            defaultValue: "{{name}}'s team",
            name: teamLead.name,
          }),
          description: t('teamHierarchyTeamDescription', {
            defaultValue: 'Direct and indirect reports for this team lead.',
          }),
          type: 'team',
        });
      });

      if (unassignedMembers.length > 0) {
        groups.push({
          teamLead: null,
          directReports: unassignedMembers,
          indirectReports: [],
          titleKey: 'teamHierarchyUnassignedTitle',
          title: t('teamHierarchyUnassignedTitle', { defaultValue: 'Unassigned members' }),
          description: t('teamHierarchyUnassignedDescription', {
            defaultValue: 'Members who are not assigned to a team lead yet.',
          }),
          type: 'unassigned',
        });
      }

      return groups;
    },
    [t]
  );

  const hierarchyGroups = useMemo(
    () => organizeHierarchy(hierarchyData),
    [hierarchyData, organizeHierarchy]
  );

  const filteredGroups = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchValue);

    if (!normalizedQuery) {
      return hierarchyGroups;
    }

    const memberMatchesQuery = (member: TeamMember) =>
      [
        member.name,
        member.email,
        member.role_name,
        member.hierarchy_path,
        member.level.toString(),
        member.reports_to_member_id ?? '',
      ].some(value => normalizeSearchValue(value).includes(normalizedQuery));

    return hierarchyGroups
      .map(group => {
        const matchesGroupMetadata = [group.title, group.description, group.type].some(value =>
          normalizeSearchValue(value).includes(normalizedQuery)
        );

        const teamLeadMatches = group.teamLead ? memberMatchesQuery(group.teamLead) : false;
        const filteredDirectReports = group.directReports.filter(memberMatchesQuery);
        const filteredIndirectReports = group.indirectReports.filter(memberMatchesQuery);

        if (
          matchesGroupMetadata ||
          teamLeadMatches ||
          filteredDirectReports.length > 0 ||
          filteredIndirectReports.length > 0
        ) {
          return {
            ...group,
            directReports: matchesGroupMetadata ? group.directReports : filteredDirectReports,
            indirectReports: matchesGroupMetadata ? group.indirectReports : filteredIndirectReports,
          };
        }

        return null;
      })
      .filter((group): group is HierarchyGroup => Boolean(group));
  }, [hierarchyGroups, searchValue]);

  const summary = useMemo(() => {
    const totalMembers = hierarchyData.length;
    const teamLeadsCount = hierarchyData.filter(
      member => member.role_name === TEAM_LEAD_ROLE
    ).length;
    const assignedMembersCount = hierarchyData.filter(member => member.reports_to_member_id).length;
    const unassignedMembersCount = hierarchyData.filter(
      member =>
        !member.reports_to_member_id &&
        member.role_name !== TEAM_LEAD_ROLE &&
        !LEADERSHIP_ROLES.has(member.role_name)
    ).length;

    return {
      totalMembers,
      teamLeadsCount,
      assignedMembersCount,
      unassignedMembersCount,
    };
  }, [hierarchyData]);

  const getGroupAccentColor = useCallback(
    (group: HierarchyGroup) => {
      if (group.type === 'management') {
        return token.colorWarning;
      }

      if (group.type === 'unassigned') {
        return token.colorInfo;
      }

      return token.colorPrimary;
    },
    [token.colorInfo, token.colorPrimary, token.colorWarning]
  );

  const SummaryCard = ({ icon, label, value, accentColor }: SummaryCardProps) => (
    <Card
      size="small"
      styles={{ body: { padding: 16 } }}
      style={{
        height: '100%',
        borderColor: token.colorBorderSecondary,
        background: token.colorBgContainer,
      }}
    >
      <Flex align="center" gap={12}>
        <Flex
          align="center"
          justify="center"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            color: accentColor,
            background: token.colorFillAlter,
            flexShrink: 0,
          }}
        >
          {icon}
        </Flex>
        <Flex vertical gap={2}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {label}
          </Text>
          <Text strong style={{ fontSize: 22, lineHeight: 1.1 }}>
            {value}
          </Text>
        </Flex>
      </Flex>
    </Card>
  );

  const MemberCard = ({
    member,
    accentColor,
    badgeLabel,
    isTeamLead = false,
    isIndirect = false,
  }: MemberCardProps) => (
    <Card
      size="small"
      styles={{ body: { padding: 12 } }}
      style={{
        height: '100%',
        borderColor: isTeamLead ? accentColor : token.colorBorderSecondary,
        borderStyle: isIndirect ? 'dashed' : 'solid',
        background: isTeamLead ? token.colorPrimaryBg : token.colorBgContainer,
        boxShadow: 'none',
      }}
    >
      <Flex vertical gap={10}>
        <Flex align="flex-start" gap={12}>
          <Avatar
            size={isTeamLead ? 44 : 36}
            icon={<UserOutlined />}
            style={{
              backgroundColor: getRoleColor(member.role_name),
              flexShrink: 0,
            }}
          />
          <Flex vertical gap={4} style={{ minWidth: 0, flex: 1 }}>
            <Flex align="center" gap={8} wrap>
              <Text strong ellipsis style={{ fontSize: isTeamLead ? 15 : 14, margin: 0 }}>
                {member.name}
              </Text>
              {isTeamLead ? (
                <Tooltip
                  title={t('teamHierarchyLeadBadge', {
                    defaultValue: 'Team lead',
                  })}
                >
                  <CrownOutlined style={{ color: token.colorWarning }} />
                </Tooltip>
              ) : null}
              <Tag color={getRoleColor(member.role_name)} style={{ marginInlineEnd: 0 }}>
                {member.role_name}
              </Tag>
            </Flex>

            <Flex align="center" gap={6} wrap>
              <MailOutlined style={{ color: token.colorTextTertiary }} />
              <Text ellipsis type="secondary" style={{ minWidth: 0 }}>
                {member.email}
              </Text>
            </Flex>
          </Flex>
        </Flex>

        <Flex align="center" justify="space-between" gap={8} wrap>
          <Tag
            bordered={false}
            style={{
              margin: 0,
              color: accentColor,
              background: token.colorFillAlter,
            }}
          >
            {badgeLabel}
          </Tag>

          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('teamHierarchyLevelLabel', {
              defaultValue: 'Level {{level}}',
              level: member.level,
            })}
          </Text>
        </Flex>
      </Flex>
    </Card>
  );

  const renderMembersSection = (
    members: TeamMember[],
    accentColor: string,
    badgeLabel: string,
    sectionTitle: string,
    isIndirectSection = false
  ) => {
    if (!members.length) {
      return null;
    }

    return (
      <Flex vertical gap={12}>
        <Flex align="center" justify="space-between" gap={12} wrap>
          <Text strong>{sectionTitle}</Text>
          <Badge
            count={members.length}
            style={{
              backgroundColor: accentColor,
            }}
          />
        </Flex>

        <Row gutter={[12, 12]}>
          {members.map(member => (
            <Col key={member.id} xs={24} sm={12} xl={12}>
              <MemberCard
                member={member}
                accentColor={accentColor}
                badgeLabel={badgeLabel}
                isIndirect={isIndirectSection}
              />
            </Col>
          ))}
        </Row>
      </Flex>
    );
  };

  if (loading) {
    return (
      <Card style={{ borderColor: token.colorBorderSecondary }}>
        <Flex vertical align="center" justify="center" gap={12} style={{ paddingBlock: 48 }}>
          <Spin size="large" />
          <Text type="secondary">
            {t('teamHierarchyLoading', {
              defaultValue: 'Loading team hierarchy...',
            })}
          </Text>
        </Flex>
      </Card>
    );
  }

  if (error) {
    return (
      <Card style={{ borderColor: token.colorBorderSecondary }}>
        <Alert
          message={t('teamHierarchyErrorTitle', {
            defaultValue: 'Unable to load team hierarchy',
          })}
          description={error}
          type="error"
          showIcon
          action={
            <Button type="link" icon={<ReloadOutlined />} onClick={fetchHierarchy}>
              {t('teamHierarchyRetry', {
                defaultValue: 'Retry',
              })}
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <Flex vertical gap={20} style={{ width: '100%' }}>
      <Card
        styles={{ body: { padding: 20 } }}
        style={{
          borderColor: token.colorBorderSecondary,
          background: token.colorBgContainer,
        }}
      >
        <Flex vertical gap={20}>
          <Flex justify="space-between" align="flex-start" gap={16} wrap>
            <Flex vertical gap={6}>
              <Space size={10} align="center">
                <Flex
                  align="center"
                  justify="center"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    color: token.colorPrimary,
                    background: token.colorPrimaryBg,
                  }}
                >
                  <TeamOutlined style={{ fontSize: 18 }} />
                </Flex>
                <Title level={4} style={{ margin: 0 }}>
                  {t('teamHierarchyTitle', {
                    defaultValue: 'Team hierarchy',
                  })}
                </Title>
              </Space>

              <Text type="secondary">
                {t('teamHierarchyDescription', {
                  defaultValue:
                    'Explore reporting lines, team lead coverage, and members who still need assignments.',
                })}
              </Text>
            </Flex>

            <Button icon={<ReloadOutlined />} onClick={fetchHierarchy}>
              {t('teamHierarchyRefresh', {
                defaultValue: 'Refresh',
              })}
            </Button>
          </Flex>

          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12} xl={6}>
              <SummaryCard
                icon={<TeamOutlined />}
                label={t('teamHierarchySummaryTotalMembers', {
                  defaultValue: 'Total members',
                })}
                value={summary.totalMembers}
                accentColor={token.colorPrimary}
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <SummaryCard
                icon={<UsergroupAddOutlined />}
                label={t('teamHierarchySummaryTeamLeads', {
                  defaultValue: 'Team leads',
                })}
                value={summary.teamLeadsCount}
                accentColor={token.colorSuccess}
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <SummaryCard
                icon={<CrownOutlined />}
                label={t('teamHierarchySummaryAssignedMembers', {
                  defaultValue: 'Assigned members',
                })}
                value={summary.assignedMembersCount}
                accentColor={token.colorWarning}
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <SummaryCard
                icon={<UserSwitchOutlined />}
                label={t('teamHierarchySummaryUnassignedMembers', {
                  defaultValue: 'Unassigned members',
                })}
                value={summary.unassignedMembersCount}
                accentColor={token.colorInfo}
              />
            </Col>
          </Row>

          <Input
            allowClear
            value={searchValue}
            onChange={event => setSearchValue(event.target.value)}
            prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
            placeholder={t('teamHierarchySearchPlaceholder', {
              defaultValue: 'Search by name, email, role, or team',
            })}
            aria-label={t('teamHierarchySearchLabel', {
              defaultValue: 'Search team hierarchy',
            })}
          />
        </Flex>
      </Card>

      {hierarchyGroups.length === 0 ? (
        <Card style={{ borderColor: token.colorBorderSecondary }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Flex vertical align="center" gap={4}>
                <Text strong>
                  {t('teamHierarchyEmptyTitle', {
                    defaultValue: 'No team hierarchy found',
                  })}
                </Text>
                <Text type="secondary">
                  {t('teamHierarchyEmptyDescription', {
                    defaultValue: 'Assign members to team leads to build the reporting structure.',
                  })}
                </Text>
              </Flex>
            }
          />
        </Card>
      ) : filteredGroups.length === 0 ? (
        <Card style={{ borderColor: token.colorBorderSecondary }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Flex vertical align="center" gap={4}>
                <Text strong>
                  {t('teamHierarchyNoResultsTitle', {
                    defaultValue: 'No matching members',
                  })}
                </Text>
                <Text type="secondary">
                  {t('teamHierarchyNoResultsDescription', {
                    defaultValue: 'Try a different search term.',
                  })}
                </Text>
              </Flex>
            }
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredGroups.map(group => {
            const accentColor = getGroupAccentColor(group);

            return (
              <Col key={`${group.type}-${group.teamLead?.id ?? group.titleKey}`} xs={24} xxl={12}>
                <Card
                  title={
                    <Flex align="center" justify="space-between" gap={12} wrap>
                      <Flex vertical gap={2}>
                        <Space size={8}>
                          {group.type === 'management' ? (
                            <CrownOutlined style={{ color: accentColor }} />
                          ) : group.type === 'unassigned' ? (
                            <UserSwitchOutlined style={{ color: accentColor }} />
                          ) : (
                            <UsergroupAddOutlined style={{ color: accentColor }} />
                          )}
                          <Text strong>{group.title}</Text>
                        </Space>
                        <Text type="secondary" style={{ fontWeight: 400 }}>
                          {group.description}
                        </Text>
                      </Flex>
                      <Badge
                        count={
                          (group.teamLead ? 1 : 0) +
                          group.directReports.length +
                          group.indirectReports.length
                        }
                        style={{ backgroundColor: accentColor }}
                      />
                    </Flex>
                  }
                  styles={{ body: { padding: 16 } }}
                  style={{
                    height: '100%',
                    borderColor: token.colorBorderSecondary,
                  }}
                >
                  <Flex vertical gap={16}>
                    {group.teamLead ? (
                      <Flex vertical gap={12}>
                        <Text strong>
                          {t('teamHierarchyLeadSectionTitle', {
                            defaultValue: 'Team lead',
                          })}
                        </Text>
                        <MemberCard
                          member={group.teamLead}
                          accentColor={accentColor}
                          badgeLabel={t('teamHierarchyLeadBadge', {
                            defaultValue: 'Team lead',
                          })}
                          isTeamLead
                        />
                      </Flex>
                    ) : null}

                    {renderMembersSection(
                      group.directReports,
                      accentColor,
                      group.type === 'management'
                        ? t('teamHierarchyLeadershipBadge', {
                            defaultValue: 'Workspace leader',
                          })
                        : group.type === 'unassigned'
                          ? t('teamHierarchyUnassignedBadge', {
                              defaultValue: 'Needs assignment',
                            })
                          : t('teamHierarchyDirectBadge', {
                              defaultValue: 'Direct report',
                            }),
                      group.type === 'management'
                        ? t('teamHierarchyLeadershipSectionTitle', {
                            defaultValue: 'Leadership members',
                          })
                        : group.type === 'unassigned'
                          ? t('teamHierarchyUnassignedSectionTitle', {
                              defaultValue: 'Members awaiting assignment',
                            })
                          : t('teamHierarchyDirectSectionTitle', {
                              defaultValue: 'Direct reports',
                            })
                    )}

                    {renderMembersSection(
                      group.indirectReports,
                      accentColor,
                      t('teamHierarchyIndirectBadge', {
                        defaultValue: 'Indirect report',
                      }),
                      t('teamHierarchyIndirectSectionTitle', {
                        defaultValue: 'Indirect reports',
                      }),
                      true
                    )}
                  </Flex>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </Flex>
  );
};

export default TeamHierarchy;
