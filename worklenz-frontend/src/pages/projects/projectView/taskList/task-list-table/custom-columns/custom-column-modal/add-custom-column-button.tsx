import { PlusOutlined } from '@/shared/antd-imports';
import { Button, Tooltip } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setCustomColumnModalAttributes,
  toggleCustomColumnModalOpen,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';

const AddCustomColumnButton = () => {
  const dispatch = useAppDispatch();

  const handleModalOpen = () => {
    dispatch(setCustomColumnModalAttributes({ modalType: 'create', columnId: null }));
    dispatch(toggleCustomColumnModalOpen(true));
  };

  return (
    <>
      <Tooltip title={'Add a custom column'}>
        <Button
          icon={<PlusOutlined />}
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
          }}
          onClick={handleModalOpen}
        />
      </Tooltip>
    </>
  );
};

export default AddCustomColumnButton;
