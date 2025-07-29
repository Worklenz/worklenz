import { Button, Card, Checkbox, Flex, List, Typography } from '@/shared/antd-imports';
import { CheckboxChangeEvent } from 'antd/es/checkbox';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { useEffect, useState } from 'react';

interface AssigneesDropdownProps {
  members: ITeamMemberViewModel[];
  themeMode: string;
  onApply: (selectedAssignees: ITeamMemberViewModel[]) => void;
  onClose: () => void;
  t: (key: string) => string;
}

const AssigneesDropdown = ({ members, themeMode, onApply, onClose, t }: AssigneesDropdownProps) => {
  const [selectedAssignees, setSelectedAssignees] = useState<ITeamMemberViewModel[]>([]);

  const handleAssigneeChange = (e: CheckboxChangeEvent, member: ITeamMemberViewModel) => {
    if (e.target.checked) {
      setSelectedAssignees(prev => [...prev, member]);
    } else {
      setSelectedAssignees(prev => prev.filter(m => m.id !== member.id));
    }
  };

  const handleClose = () => {
    setSelectedAssignees([]);
    onClose();
  };

  return (
    <Card className="custom-card" styles={{ body: { padding: 8 } }}>
      <Flex vertical>
        <List style={{ padding: 0, height: 250, overflow: 'auto' }}>
          {members?.map(member => (
            <List.Item
              className={`${themeMode === 'dark' ? 'custom-list-item dark' : 'custom-list-item'} ${member.pending_invitation ? 'cursor-not-allowed' : ''}`}
              key={member.id}
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-start',
                padding: '4px 8px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Checkbox
                disabled={member.pending_invitation}
                checked={selectedAssignees.some(a => a.id === member.id)}
                onChange={e => handleAssigneeChange(e, member)}
              >
                <Flex align="center">
                  <SingleAvatar
                    avatarUrl={member.avatar_url}
                    name={member.name}
                    email={member.email}
                  />
                  <Flex vertical>
                    <Typography.Text>{member.name}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {member.email}&nbsp;
                      {member.pending_invitation && (
                        <Typography.Text type="danger" style={{ fontSize: 10 }}>
                          ({t('pendingInvitation')})
                        </Typography.Text>
                      )}
                    </Typography.Text>
                  </Flex>
                </Flex>
              </Checkbox>
            </List.Item>
          ))}
        </List>
        <Button
          type="primary"
          size="small"
          style={{ width: '100%' }}
          onClick={() => {
            handleClose();
            onApply(selectedAssignees);
          }}
        >
          {t('apply')}
        </Button>
      </Flex>
    </Card>
  );
};

export default AssigneesDropdown;
