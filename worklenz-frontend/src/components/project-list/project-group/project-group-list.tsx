import React from 'react';
import { Card, Col, Empty, Row, Skeleton, Tag, Typography, Progress, Tooltip } from 'antd';
import { ClockCircleOutlined, TeamOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { ProjectGroupListProps } from '@/types/project/project.types';

const { Title, Text } = Typography;

const ProjectGroupList: React.FC<ProjectGroupListProps> = ({
  groups,
  navigate,
  onProjectSelect,
  loading,
  t
}) => {
  if (loading) {
    return <Skeleton active />;
  }

  if (groups.length === 0) {
    return <Empty description={t('noProjects')} />;
  }

  return (
    <div className="project-group-container">
      {groups.map(group => (
        <div key={group.groupKey} className="project-group">
          <div className="project-group-header">
            {group.groupColor && (
              <span 
                className="group-color-indicator" 
                style={{ backgroundColor: group.groupColor }}
              />
            )}
            <Title level={4} className="project-group-title">
              {group.groupName} 
              <Text type="secondary" className="group-stats">
                ({group.count} projects • {group.averageProgress}% avg • {group.totalTasks} tasks)
              </Text>
            </Title>
          </div>
          <Row gutter={[16, 16]}>
            {group.projects.map(project => (
              <Col key={project.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  onClick={() => onProjectSelect(project.id)}
                  className="project-card"
                  cover={
                    project.status_color && (
                      <div 
                        className="project-status-bar"
                        style={{ backgroundColor: project.status_color }}
                      />
                    )
                  }
                >
                  <div className="project-card-content">
                    <Title level={5} ellipsis={{ rows: 2 }} className="project-title">
                      {project.name}
                    </Title>
                    
                    {project.client_name && (
                      <Text type="secondary" className="project-client">
                        {project.client_name}
                      </Text>
                    )}
                    
                    <Progress 
                      percent={project.progress} 
                      size="small" 
                      status="active" 
                      className="project-progress"
                    />
                    
                    <div className="project-meta">
                      <Tooltip title="Tasks">
                        <span>
                          <CheckCircleOutlined /> {project.completed_tasks_count || 0}/{project.all_tasks_count || 0}
                        </span>
                      </Tooltip>
                      
                      <Tooltip title="Members">
                        <span>
                          <TeamOutlined /> {project.members_count || 0}
                        </span>
                      </Tooltip>
                      
                      {project.updated_at_string && (
                        <Tooltip title="Last updated">
                          <span>
                            <ClockCircleOutlined /> {project.updated_at_string}
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ))}
    </div>
  );
};

export default ProjectGroupList;