import {
  Button,
  Divider,
  Flex,
  Form,
  Input,
  message,
  Modal,
  Select,
  Typography,
  Popconfirm,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import SelectionTypeColumn from './selection-type-column/selection-type-column';
import NumberTypeColumn from './number-type-column/number-type-column';
import LabelTypeColumn from './label-type-column/label-type-column';
import FormulaTypeColumn from './formula-type-column/formula-type-column';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  CustomFieldNumberTypes,
  CustomFieldsTypes,
  setCustomColumnModalAttributes,
  setCustomFieldType,
  toggleCustomColumnModalOpen,
  setCustomFieldNumberType,
  setDecimals,
  setLabel,
  setLabelPosition,
  setExpression,
  setFirstNumericColumn,
  setSecondNumericColumn,
  setSelectionsList,
  setLabelsList,
  resetCustomFieldValues,
} from '@features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import CustomColumnHeader from '../custom-column-header/custom-column-header';
import { nanoid } from '@reduxjs/toolkit';
import {
  CustomTableColumnsType,
  deleteCustomColumn as deleteCustomColumnFromColumns,
} from '@features/projects/singleProject/taskListColumns/taskColumnsSlice';
import { themeWiseColor } from '@/utils/themeWiseColor';
import KeyTypeColumn from './key-type-column/key-type-column';
import logger from '@/utils/errorLogger';
import {
  fetchTasksV3,
  fetchTaskListColumns,
  addCustomColumn,
  deleteCustomColumn as deleteCustomColumnFromTaskManagement,
  toggleColumnVisibility as toggleColumnVisibilityV2,
} from '@/features/task-management/task-management.slice';
import { useParams } from 'react-router-dom';
import { tasksCustomColumnsService } from '@/api/tasks/tasks-custom-columns.service';
import { ExclamationCircleFilled } from '@/shared/antd-imports';
import {
  toggleColumnVisibility,
  updateCustomColumnPinned,
} from '@/features/tasks/tasks.slice';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useCustomColumnVisibility } from '@/hooks/useCustomColumnVisibility';
import { useState } from 'react';

const CustomColumnModal = () => {
  const [mainForm] = Form.useForm();
  const { projectId } = useParams();
  const { t } = useTranslation('task-list-table');
  const { socket } = useSocket();

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();

  const {
    customColumnId,
    customColumnModalType,
    isCustomColumnModalOpen,
    currentColumnData,
    decimals,
    label,
    labelPosition,
    previewValue,
    expression,
    firstNumericColumn,
    secondNumericColumn,
    labelsList,
    selectionsList,
    customFieldType,
  } = useAppSelector(state => state.taskListCustomColumnsReducer);

  const fieldType: CustomFieldsTypes = useAppSelector(
    state => state.taskListCustomColumnsReducer.customFieldType
  );
  const numberType: CustomFieldNumberTypes = useAppSelector(
    state => state.taskListCustomColumnsReducer.customFieldNumberType
  );

  const openedColumn = currentColumnData;
  const { isHidden, toggleVisibility } = useCustomColumnVisibility();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetModalData = () => {
    mainForm.resetFields();
    dispatch(resetCustomFieldValues());
    dispatch(setCustomColumnModalAttributes({ modalType: 'create', columnId: null }));
  };

  const handleDeleteColumn = async () => {
    const columnUUID =
      customColumnId ||
      openedColumn?.uuid ||
      openedColumn?.id ||
      openedColumn?.custom_column_obj?.uuid ||
      openedColumn?.custom_column_obj?.id;

    if (!customColumnId || !columnUUID) {
      // message.error(
      //   t('customColumns.modal.deleteErrorMissingId', {
      //     defaultValue: 'Cannot delete column: Missing UUID',
      //   })
      // );
      return;
    }

    try {
      await tasksCustomColumnsService.deleteCustomColumn(columnUUID);
      dispatch(deleteCustomColumnFromTaskManagement(customColumnId));
      dispatch(deleteCustomColumnFromColumns(customColumnId));
      dispatch(toggleCustomColumnModalOpen(false));
      resetModalData();
      // message.success(t('customColumns.modal.deleteSuccessMessage'));

      if (projectId) {
        dispatch(fetchTaskListColumns(projectId));
        dispatch(fetchTasksV3(projectId));
      }
    } catch (error) {
      logger.error('Error deleting custom column:', error);
      // message.error(t('customColumns.modal.deleteErrorMessage'));
    }
  };

  // Always hides the column — never toggles back to visible from this button.
  // Use the Fields dropdown (Show Fields) to make a hidden column visible again.
  const handleHideColumn = () => {
    if (!customColumnId || !openedColumn) return;

    const col = openedColumn;
    const colKey = col.key as string | undefined;
    const colUUID: string = (col as any).uuid || customColumnId;

    // Mark as hidden in localStorage visibility tracker
    if (!isHidden(colUUID)) {
      toggleVisibility(colUUID);
    }

    // Update tasks.slice (used by the old task-list-table) — force pinned = false
    dispatch(
      updateCustomColumnPinned({
        columnId: colUUID,
        columnKey: colKey,
        isVisible: false,
      })
    );

    // Update task-management.slice (used by TaskListV2Table) — force pinned = false
    // toggleColumnVisibilityV2 flips the value, so only call it when currently visible
    if (colKey) {
      dispatch(toggleColumnVisibility(colKey));
      dispatch(toggleColumnVisibilityV2(colKey));
    }

    // Emit socket event so the backend persists is_visible = false
    socket?.emit(SocketEvents.CUSTOM_COLUMN_PINNED_CHANGE.toString(), {
      column_id: colUUID,
      project_id: projectId,
      is_visible: false,
    });

    // Close modal
    dispatch(toggleCustomColumnModalOpen(false));
    resetModalData();
  };

  const fieldTypesOptions = [
    { key: 'people', value: 'people', label: t('customColumns.fieldTypes.people'), disabled: false },
    { key: 'text', value: 'text', label: t('customColumns.fieldTypes.text'), disabled: false },
    { key: 'number', value: 'number', label: t('customColumns.fieldTypes.number'), disabled: false },
    { key: 'date', value: 'date', label: t('customColumns.fieldTypes.date'), disabled: false },
    { key: 'selection', value: 'selection', label: t('customColumns.fieldTypes.selection'), disabled: false },
  ];

  const handleFormSubmit = async (value: any) => {
      if (isSubmitting) return;          // ← guard: drop extra clicks
  setIsSubmitting(true);             // ← lock the button
    try {
      if (customColumnModalType === 'create') {
        const columnKey = nanoid();

        const newColumn: CustomTableColumnsType = {
          key: columnKey,
          name: value.fieldTitle,
          columnHeader: <CustomColumnHeader columnKey={columnKey} columnName={value.fieldTitle} />,
          width: 120,
          isVisible: true,
          custom_column: true,
          custom_column_obj: {
            ...value,
            labelsList: value.fieldType === 'labels' ? labelsList : [],
            selectionsList: value.fieldType === 'selection' ? selectionsList : [],
          },
        };

        const configuration = {
          field_title: value.fieldTitle,
          field_type: value.fieldType,
          number_type: value.numberType,
          decimals: value.decimals,
          label: value.label,
          label_position: value.labelPosition,
          preview_value: value.previewValue,
          expression: value.expression,
          first_numeric_column_key: value.firstNumericColumn?.key,
          second_numeric_column_key: value.secondNumericColumn?.key,
          selections_list:
            value.fieldType === 'selection'
              ? selectionsList.map((selection, index) => ({
                  selection_id: selection.selection_id,
                  selection_name: selection.selection_name,
                  selection_color: selection.selection_color,
                  selection_order: index,
                }))
              : [],
          labels_list:
            value.fieldType === 'labels'
              ? labelsList.map((label, index) => ({
                  label_id: label.label_id,
                  label_name: label.label_name,
                  label_color: label.label_color,
                  label_order: index,
                }))
              : [],
        };

        try {
          const res = await tasksCustomColumnsService.createCustomColumn(projectId || '', {
            name: value.fieldTitle,
            key: columnKey,
            field_type: value.fieldType,
            width: 120,
            is_visible: true,
            configuration,
          });

          if (res.done) {
            if (res.body.id) newColumn.id = res.body.id;
            dispatch(addCustomColumn(newColumn));
            dispatch(toggleCustomColumnModalOpen(false));
            resetModalData();
            message.success(t('customColumns.modal.createSuccessMessage'));

            if (projectId) {
              dispatch(fetchTaskListColumns(projectId));
              dispatch(fetchTasksV3(projectId));
            }
            setIsSubmitting(false);  
          }
        } catch (error) {
          logger.error('Error creating custom column:', error);
          message.error(t('customColumns.modal.createErrorMessage'));
          setIsSubmitting(false);
        }
      } else if (customColumnModalType === 'edit' && customColumnId) {
        const updatedColumn = openedColumn
          ? {
              ...openedColumn,
              name: value.fieldTitle,
              columnHeader: (
                <CustomColumnHeader columnKey={customColumnId} columnName={value.fieldTitle} />
              ),
              custom_column_obj: {
                ...openedColumn.custom_column_obj,
                fieldTitle: value.fieldTitle,
                fieldType: value.fieldType,
                numberType: value.numberType,
                decimals: value.decimals,
                label: value.label,
                labelPosition: value.labelPosition,
                previewValue: value.previewValue,
                expression: value.expression,
                firstNumericColumn: value.firstNumericColumn,
                secondNumericColumn: value.secondNumericColumn,
                labelsList: value.fieldType === 'labels' ? labelsList : [],
                selectionsList: value.fieldType === 'selection' ? selectionsList : [],
              },
            }
          : null;

        const updateColumnUUID =
          customColumnId ||
          openedColumn?.uuid ||
          openedColumn?.id ||
          openedColumn?.custom_column_obj?.uuid ||
          openedColumn?.custom_column_obj?.id;

        if (updatedColumn && updateColumnUUID) {
          try {
            const configuration = {
              field_title: value.fieldTitle,
              field_type: value.fieldType,
              number_type: value.numberType,
              decimals: value.decimals,
              label: value.label,
              label_position: value.labelPosition,
              preview_value: value.previewValue,
              expression: value.expression,
              first_numeric_column_key: value.firstNumericColumn?.key,
              second_numeric_column_key: value.secondNumericColumn?.key,
              selections_list:
                value.fieldType === 'selection'
                  ? selectionsList.map((selection, index) => ({
                      selection_id: selection.selection_id,
                      selection_name: selection.selection_name,
                      selection_color: selection.selection_color,
                      selection_order: index,
                    }))
                  : [],
              labels_list:
                value.fieldType === 'labels'
                  ? labelsList.map((label, index) => ({
                      label_id: label.label_id,
                      label_name: label.label_name,
                      label_color: label.label_color,
                      label_order: index,
                    }))
                  : [],
            };

            await tasksCustomColumnsService.updateCustomColumn(updateColumnUUID, {
              name: value.fieldTitle,
              field_type: value.fieldType,
              width: 150,
              is_visible: true,
              configuration,
            });

            dispatch(toggleCustomColumnModalOpen(false));
            resetModalData();
            // message.success(t('customColumns.modal.updateSuccessMessage'));

            if (projectId) {
              dispatch(fetchTaskListColumns(projectId));
              dispatch(fetchTasksV3(projectId));
            }
            setIsSubmitting(false);
          } catch (error) {
            logger.error('Error updating custom column:', error);
            // message.error(t('customColumns.modal.updateErrorMessage'));
            setIsSubmitting(false);
          }
        }
      }

      mainForm.resetFields();
    } catch (error) {
      logger.error('error in custom column modal', error);
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={t('customColumns.modal.addFieldTitle')}
      centered
      open={isCustomColumnModalOpen}
      onCancel={() => {
        dispatch(toggleCustomColumnModalOpen(false));
        resetModalData();
      }}
      styles={{
        header: { position: 'relative' },
        footer: { display: 'none' },
      }}
      afterOpenChange={open => {
        if (open && customColumnModalType === 'edit' && openedColumn) {
          dispatch(setCustomFieldType(openedColumn.custom_column_obj?.fieldType || 'people'));

          if (openedColumn.custom_column_obj?.fieldType === 'number') {
            dispatch(setCustomFieldNumberType(openedColumn.custom_column_obj?.numberType || 'formatted'));
            dispatch(setDecimals(openedColumn.custom_column_obj?.decimals || 0));
            dispatch(setLabel(openedColumn.custom_column_obj?.label || ''));
            dispatch(setLabelPosition(openedColumn.custom_column_obj?.labelPosition || 'left'));
          } else if (openedColumn.custom_column_obj?.fieldType === 'formula') {
            dispatch(setExpression(openedColumn.custom_column_obj?.expression || 'add'));
            dispatch(setFirstNumericColumn(openedColumn.custom_column_obj?.firstNumericColumn || null));
            dispatch(setSecondNumericColumn(openedColumn.custom_column_obj?.secondNumericColumn || null));
          } else if (openedColumn.custom_column_obj?.fieldType === 'selection') {
            if (Array.isArray(openedColumn.custom_column_obj?.selectionsList)) {
              dispatch(setSelectionsList(openedColumn.custom_column_obj.selectionsList));
            }
          } else if (openedColumn.custom_column_obj?.fieldType === 'labels') {
            if (Array.isArray(openedColumn.custom_column_obj?.labelsList)) {
              dispatch(setLabelsList(openedColumn.custom_column_obj.labelsList));
            }
          }

          mainForm.setFieldsValue({
            fieldTitle: openedColumn.name || openedColumn.custom_column_obj?.fieldTitle,
            fieldType: openedColumn.custom_column_obj?.fieldType,
            numberType: openedColumn.custom_column_obj?.numberType,
            decimals: openedColumn.custom_column_obj?.decimals,
            label: openedColumn.custom_column_obj?.label,
            labelPosition: openedColumn.custom_column_obj?.labelPosition,
            previewValue: openedColumn.custom_column_obj?.previewValue,
            expression: openedColumn.custom_column_obj?.expression,
            firstNumericColumn: openedColumn.custom_column_obj?.firstNumericColumn,
            secondNumericColumn: openedColumn.custom_column_obj?.secondNumericColumn,
          });
        } else if (open && customColumnModalType === 'create') {
          resetModalData();
        } else if (!open) {
          resetModalData();
        }
      }}
    >
      <Divider style={{ position: 'absolute', left: 0, top: 32 }} />

      <Form
        form={mainForm}
        layout="vertical"
        onFinish={handleFormSubmit}
        style={{ marginBlockStart: 24 }}
        initialValues={
          customColumnModalType === 'create'
            ? {
                fieldType,
                numberType,
                decimals,
                label,
                labelPosition,
                previewValue,
                expression,
                firstNumericColumn,
                secondNumericColumn,
              }
            : {
                fieldTitle: openedColumn?.custom_column_obj.fieldTitle,
                fieldType: openedColumn?.custom_column_obj.fieldType,
                numberType: openedColumn?.custom_column_obj.numberType,
                decimals: openedColumn?.custom_column_obj.decimals,
                label: openedColumn?.custom_column_obj.label,
                labelPosition: openedColumn?.custom_column_obj.labelPosition,
                previewValue: openedColumn?.custom_column_obj.previewValue,
                expression: openedColumn?.custom_column_obj.expression,
                firstNumericColumn: openedColumn?.custom_column_obj.firstNumericColumn,
                secondNumericColumn: openedColumn?.custom_column_obj.secondNumericColumn,
              }
        }
      >
        <Flex gap={16} align="center" justify="space-between">
          <Form.Item
            name={'fieldTitle'}
            label={<Typography.Text>{t('customColumns.modal.fieldTitle')}</Typography.Text>}
            layout="vertical"
            rules={[{ required: true, message: t('customColumns.modal.fieldTitleRequired') }]}
            required={false}
          >
            <Input
              placeholder={t('customColumns.modal.columnTitlePlaceholder')}
              style={{ minWidth: '100%', width: 300 }}
            />
          </Form.Item>

          <Form.Item
            name={'fieldType'}
            label={<Typography.Text>{t('customColumns.modal.type')}</Typography.Text>}
            layout="vertical"
          >
            <Select
              options={fieldTypesOptions}
              defaultValue={fieldType}
              value={fieldType}
              onChange={value => dispatch(setCustomFieldType(value))}
              style={{
                minWidth: '100%',
                width: 150,
                border: `1px solid ${themeWiseColor('#d9d9d9', '#424242', themeMode)}`,
                borderRadius: 4,
              }}
            />
          </Form.Item>
        </Flex>

        {customFieldType === 'key' && <KeyTypeColumn />}
        {customFieldType === 'number' && <NumberTypeColumn />}
        {customFieldType === 'formula' && <FormulaTypeColumn />}
        {customFieldType === 'labels' && <LabelTypeColumn />}
        {customFieldType === 'selection' && <SelectionTypeColumn />}

        <Flex
          gap={8}
          align="center"
          justify={`${customColumnModalType === 'create' ? 'flex-end' : 'space-between'}`}
          style={{ marginBlockStart: 24 }}
        >
          {customColumnModalType === 'edit' && customColumnId && (
            <Flex gap={8}>
              {/* Always hides the column — use the Fields dropdown to show it again */}
              <Button onClick={handleHideColumn}>
                {t('customColumns.modal.hideFromTaskList', {
                  defaultValue: 'Hide from task list',
                })}
              </Button>

              {/* Delete button */}
              <Popconfirm
                title={t('customColumns.modal.deleteConfirmTitle')}
                description={t('customColumns.modal.deleteConfirmDescription')}
                icon={<ExclamationCircleFilled style={{ color: 'red' }} />}
                onConfirm={handleDeleteColumn}
                okText={t('customColumns.modal.deleteButton')}
                cancelText={t('customColumns.modal.cancelButton')}
                okButtonProps={{ danger: true }}
              >
                <Button danger>{t('customColumns.modal.deleteButton')}</Button>
              </Popconfirm>
            </Flex>
          )}

          <Flex gap={8}>
            <Button
              onClick={() => {
                dispatch(toggleCustomColumnModalOpen(false));
                resetModalData();
              }}
            >
              {t('customColumns.modal.cancelButton')}
            </Button>
            {customColumnModalType === 'create' ? (
              <Button type="primary" htmlType="submit"loading={isSubmitting} disabled={isSubmitting}>
                {t('customColumns.modal.createButton')}
              </Button>
            ) : (
              <Button type="primary" htmlType="submit"loading={isSubmitting} disabled={isSubmitting}>
                {t('customColumns.modal.updateButton')}
              </Button>
            )}
          </Flex>
        </Flex>
      </Form>

      <Divider style={{ position: 'absolute', left: 0, bottom: 42 }} />
    </Modal>
  );
};

export default CustomColumnModal;