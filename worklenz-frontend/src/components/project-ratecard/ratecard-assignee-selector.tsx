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
import SingleAvatar from '../common/single-avatar/single-avatar';
import { JobRoleType } from '@/types/project/ratecard.types';
import { IProjectMembersViewModel, IProjectMemberViewModel } from '@/types/projectMember.types';

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
  memberlist,
}: RateCardAssigneeSelectorProps) => {
  const membersInputRef = useRef<InputRef>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState<IProjectMemberViewModel[]>(memberlist || []);
  const [isLoading, setIsLoading] = useState(false);
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
      <List style={{ padding: 0, overflow: 'auto' }}>
        {filteredMembers.length ? (
          filteredMembers.map(member => (
            <List.Item
              key={member.id}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start', // changed from 'l' to 'flex-start' for left alignment
                padding: '4px 8px',
                border: 'none',
                cursor: member.pending_invitation ? 'not-allowed' : 'pointer',
                opacity: member.pending_invitation ? 0.5 : 1,
                justifyContent: 'flex-start', // ensure content is aligned left
                textAlign: 'left', // ensure text is aligned left
              }}
              onClick={() => !member.pending_invitation && onChange?.(member.id || '')}
            >
              <Checkbox
                checked={selectedMemberIds.includes(member.id || '')}
                disabled={member.pending_invitation}
                onChange={() => onChange?.(member.id || '')}
              />
              <div>
                <SingleAvatar
                  avatarUrl={member.avatar_url}
                  name={member.name}
                  email={member.email}
                />
              </div>
              <span>{member.name}</span>
              {/* <span style={{ fontSize: 12, color: '#888' }}>{member.email}</span> */}
            </List.Item>
          ))
        ) : (
          <Empty />
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
