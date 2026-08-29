import { useEffect, useRef, useState } from 'react';
import { InputRef } from 'antd/es/input';
import Dropdown from 'antd/es/dropdown';
import Card from 'antd/es/card';
import List from 'antd/es/list';
import Input from 'antd/es/input';
import Checkbox from 'antd/es/checkbox';
import Button from 'antd/es/button';
import Empty from 'antd/es/empty';
import { PlusOutlined } from '@ant-design/icons';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { IProjectMemberViewModel } from '@/types/projectMember.types';

interface RateCardAssigneeSelectorProps {
  projectId: string;
  onChange?: (memberId: string) => void;
  selectedMemberIds?: string[];
  memberlist?: IProjectMemberViewModel[];
}

const RateCardAssigneeSelector = ({
  projectId,
  onChange,
  selectedMemberIds = [],
  memberlist = [],
  assignedMembers = [], // New prop: List of all assigned member IDs across all job titles
}: RateCardAssigneeSelectorProps & { assignedMembers: string[] }) => {
  const membersInputRef = useRef<InputRef>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState<IProjectMemberViewModel[]>(memberlist);

  useEffect(() => {
    setMembers(memberlist);
  }, [memberlist]);

  const filteredMembers = members.filter(member =>
    member.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const dropdownContent = (
    <Card styles={{ body: { padding: 8 } }}>
      <Input
        ref={membersInputRef}
        value={searchQuery}
        onChange={e => setSearchQuery(e.currentTarget.value)}
        placeholder="Search members"
      />
      <List style={{ padding: 0, maxHeight: 200, overflow: 'auto' }}>
        {filteredMembers.length ? (
          filteredMembers.map(member => {
            const isAssignedToAnotherJobTitle =
              assignedMembers.includes(member.id || '') &&
              !selectedMemberIds.includes(member.id || ''); // Check if the member is assigned elsewhere

            return (
              <List.Item
                key={member.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  padding: '4px 8px',
                  border: 'none',
                  opacity: member.pending_invitation || isAssignedToAnotherJobTitle ? 0.5 : 1,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                }}
              >
                <Checkbox
                  checked={selectedMemberIds.includes(member.id || '')}
                  disabled={member.pending_invitation || isAssignedToAnotherJobTitle}
                  onChange={() => onChange?.(member.id || '')}
                />
                <SingleAvatar
                  avatarUrl={member.avatar_url}
                  name={member.name}
                  email={member.email}
                />
                <span>{member.name}</span>
              </List.Item>
            );
          })
        ) : (
          <Empty description="No members found" />
        )}
      </List>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => dropdownContent}
      onOpenChange={open => {
        if (open) setTimeout(() => membersInputRef.current?.focus(), 0);
      }}
    >
      <Button
        type="dashed"
        shape="circle"
        size="small"
        icon={<PlusOutlined style={{ fontSize: 12 }} />}
      />
    </Dropdown>
  );
};

export default RateCardAssigneeSelector;
