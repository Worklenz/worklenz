import {
  CloseCircleOutlined,
  DeleteOutlined,
  InboxOutlined,
  MoreOutlined,
  RetweetOutlined,
  TagsOutlined,
  UserAddOutlined,
  UsergroupAddOutlined,
} from '@/shared/antd-imports';
import { Button, Flex, Tooltip, Typography } from '@/shared/antd-imports';
import { colors } from '../../../styles/colors';

type BulkTasksActionProps = {
  selectedTaskIds: string[];
  closeContainer: () => void;
};

const BulkTasksActionContainer = ({ selectedTaskIds, closeContainer }: BulkTasksActionProps) => {
  const selectedTasksCount = selectedTaskIds.length;
  return (
    <Flex
      gap={12}
      align="center"
      justify="space-between"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        height: '50px',
        display: 'flex',
        alignItems: 'center',
        zIndex: 2,
        width: 'auto',
        marginInline: 24,
        background: '#252628',
        padding: '8px 24px',
        borderRadius: '120px',
        bottom: '30px',
        minWidth: '420px',
      }}
    >
      <Typography.Text
        style={{ color: colors.white }}
      >{`${selectedTasksCount} task${selectedTasksCount > 1 ? 's' : ''} selected`}</Typography.Text>

      <Flex align="center">
        <Tooltip title={'Change Status/ Prioriy/ Phases'}>
          <Button
            icon={<RetweetOutlined />}
            className="borderless-icon-btn"
            style={{ background: colors.transparent, color: colors.white }}
          />
        </Tooltip>

        <Tooltip title={'Change Label'}>
          <Button
            icon={<TagsOutlined />}
            className="borderless-icon-btn"
            style={{ background: colors.transparent, color: colors.white }}
          />
        </Tooltip>

        <Tooltip title={'Assign to me'}>
          <Button
            icon={<UserAddOutlined />}
            className="borderless-icon-btn"
            style={{ background: colors.transparent, color: colors.white }}
          />
        </Tooltip>

        <Tooltip title={'Assign members'}>
          <Button
            icon={<UsergroupAddOutlined />}
            className="borderless-icon-btn"
            style={{ background: colors.transparent, color: colors.white }}
          />
        </Tooltip>

        <Tooltip title={'Archive'}>
          <Button
            icon={<InboxOutlined />}
            className="borderless-icon-btn"
            style={{ background: colors.transparent, color: colors.white }}
          />
        </Tooltip>

        <Tooltip title={'Delete'}>
          <Button
            icon={<DeleteOutlined />}
            className="borderless-icon-btn"
            style={{ background: colors.transparent, color: colors.white }}
          />
        </Tooltip>
      </Flex>

      <Tooltip title={'More options'}>
        <Button
          icon={<MoreOutlined />}
          className="borderless-icon-btn"
          style={{ background: colors.transparent, color: colors.white }}
        />
      </Tooltip>

      <Tooltip title={'Deselect all'}>
        <Button
          icon={<CloseCircleOutlined />}
          onClick={closeContainer}
          className="borderless-icon-btn"
          style={{ background: colors.transparent, color: colors.white }}
        />
      </Tooltip>
    </Flex>
  );
};

export default BulkTasksActionContainer;
