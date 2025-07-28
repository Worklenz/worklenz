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
} from '@/features/task-management/task-management.slice';
import { useParams } from 'react-router-dom';
import { tasksCustomColumnsService } from '@/api/tasks/tasks-custom-columns.service';
import { ExclamationCircleFilled } from '@/shared/antd-imports';

const CustomColumnModal = () => {
  const [mainForm] = Form.useForm();
  const { projectId } = useParams();
  const { t } = useTranslation('task-list-table');

  //   get theme details from theme reducer
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
  // get initial data from task list custom column slice
  const fieldType: CustomFieldsTypes = useAppSelector(
    state => state.taskListCustomColumnsReducer.customFieldType
  );
  // number column initial data
  const numberType: CustomFieldNumberTypes = useAppSelector(
    state => state.taskListCustomColumnsReducer.customFieldNumberType
  );

  // Use the column data passed from TaskListV2
  const openedColumn = currentColumnData;

  // Function to reset all form and Redux state
  const resetModalData = () => {
    mainForm.resetFields();
    dispatch(resetCustomFieldValues());
    dispatch(setCustomColumnModalAttributes({ modalType: 'create', columnId: null }));
  };

  // Function to handle deleting a custom column
  const handleDeleteColumn = async () => {
    // The customColumnId should now be the UUID passed from TaskListV2
    // But also check the column data as a fallback, prioritizing uuid over id
    const columnUUID =
      customColumnId ||
      openedColumn?.uuid ||
      openedColumn?.id ||
      openedColumn?.custom_column_obj?.uuid ||
      openedColumn?.custom_column_obj?.id;

    if (!customColumnId || !columnUUID) {
      message.error('Cannot delete column: Missing UUID');
      return;
    }

    try {
      // Make API request to delete the custom column using the service
      await tasksCustomColumnsService.deleteCustomColumn(columnUUID);

      // Dispatch actions to update the Redux store
      dispatch(deleteCustomColumnFromTaskManagement(customColumnId));
      dispatch(deleteCustomColumnFromColumns(customColumnId));

      // Close the modal and reset data
      dispatch(toggleCustomColumnModalOpen(false));
      resetModalData();

      // Show success message
      message.success(t('customColumns.modal.deleteSuccessMessage'));

      // Refresh tasks and columns to reflect the deleted custom column
      if (projectId) {
        dispatch(fetchTaskListColumns(projectId));
        dispatch(fetchTasksV3(projectId));
      }
    } catch (error) {
      logger.error('Error deleting custom column:', error);
      message.error(t('customColumns.modal.deleteErrorMessage'));
    }
  };

  const fieldTypesOptions = [
    {
      key: 'people',
      value: 'people',
      label: t('customColumns.fieldTypes.people'),
      disabled: false,
    },
    {
      key: 'number',
      value: 'number',
      label: t('customColumns.fieldTypes.number'),
      disabled: false,
    },
    {
      key: 'date',
      value: 'date',
      label: t('customColumns.fieldTypes.date'),
      disabled: false,
    },
    {
      key: 'selection',
      value: 'selection',
      label: t('customColumns.fieldTypes.selection'),
      disabled: false,
    },
    {
      key: 'checkbox',
      value: 'checkbox',
      label: t('customColumns.fieldTypes.checkbox'),
      disabled: true,
    },
    {
      key: 'labels',
      value: 'labels',
      label: t('customColumns.fieldTypes.labels'),
      disabled: true,
    },
    {
      key: 'key',
      value: 'key',
      label: t('customColumns.fieldTypes.key'),
      disabled: true,
    },
    {
      key: 'formula',
      value: 'formula',
      label: t('customColumns.fieldTypes.formula'),
      disabled: true,
    },
  ];

  // function to handle form submit
  const handleFormSubmit = async (value: any) => {
    try {
      if (customColumnModalType === 'create') {
        const columnKey = nanoid(); // this id is random and unique, generated by redux

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

        // Prepare the configuration object
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

        // Make API request to create custom column using the service
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

            // Show success message
            message.success(t('customColumns.modal.createSuccessMessage'));

            // Refresh tasks and columns to include the new custom column values
            if (projectId) {
              dispatch(fetchTaskListColumns(projectId));
              dispatch(fetchTasksV3(projectId));
            }
          }
        } catch (error) {
          logger.error('Error creating custom column:', error);
          message.error(t('customColumns.modal.createErrorMessage'));
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

        // Get the correct UUID for the update operation, prioritizing uuid over id
        const updateColumnUUID =
          customColumnId ||
          openedColumn?.uuid ||
          openedColumn?.id ||
          openedColumn?.custom_column_obj?.uuid ||
          openedColumn?.custom_column_obj?.id;

        if (updatedColumn && updateColumnUUID) {
          try {
            // Prepare the configuration object
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

            // Make API request to update custom column using the service
            await tasksCustomColumnsService.updateCustomColumn(updateColumnUUID, {
              name: value.fieldTitle,
              field_type: value.fieldType,
              width: 150,
              is_visible: true,
              configuration,
            });

            // Close modal and reset data
            dispatch(toggleCustomColumnModalOpen(false));
            resetModalData();

            // Show success message
            message.success(t('customColumns.modal.updateSuccessMessage'));

            // Refresh tasks and columns to reflect the updated custom column
            if (projectId) {
              dispatch(fetchTaskListColumns(projectId));
              dispatch(fetchTasksV3(projectId));
            }
          } catch (error) {
            logger.error('Error updating custom column:', error);
            message.error(t('customColumns.modal.updateErrorMessage'));
          }
        }
      }

      mainForm.resetFields();
    } catch (error) {
      logger.error('error in custom column modal', error);
    }
  };

  return (
    <Modal
      title={
        customColumnModalType === 'create'
          ? t('customColumns.modal.addFieldTitle')
          : t('customColumns.modal.editFieldTitle')
      }
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
          // Set the field type first so the correct form fields are displayed
          dispatch(setCustomFieldType(openedColumn.custom_column_obj?.fieldType || 'people'));

          // Set other field values based on the custom column type
          if (openedColumn.custom_column_obj?.fieldType === 'number') {
            dispatch(
              setCustomFieldNumberType(openedColumn.custom_column_obj?.numberType || 'formatted')
            );
            dispatch(setDecimals(openedColumn.custom_column_obj?.decimals || 0));
            dispatch(setLabel(openedColumn.custom_column_obj?.label || ''));
            dispatch(setLabelPosition(openedColumn.custom_column_obj?.labelPosition || 'left'));
          } else if (openedColumn.custom_column_obj?.fieldType === 'formula') {
            dispatch(setExpression(openedColumn.custom_column_obj?.expression || 'add'));
            dispatch(
              setFirstNumericColumn(openedColumn.custom_column_obj?.firstNumericColumn || null)
            );
            dispatch(
              setSecondNumericColumn(openedColumn.custom_column_obj?.secondNumericColumn || null)
            );
          } else if (openedColumn.custom_column_obj?.fieldType === 'selection') {
            // Directly set the selections list in the Redux store
            if (Array.isArray(openedColumn.custom_column_obj?.selectionsList)) {
              dispatch(setSelectionsList(openedColumn.custom_column_obj.selectionsList));
            }
          } else if (openedColumn.custom_column_obj?.fieldType === 'labels') {
            // Directly set the labels list in the Redux store
            if (Array.isArray(openedColumn.custom_column_obj?.labelsList)) {
              dispatch(setLabelsList(openedColumn.custom_column_obj.labelsList));
            }
          }

          // Set form values
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
          // Reset all data for create mode
          resetModalData();
        } else if (!open) {
          // Reset data when modal closes
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
            rules={[
              {
                required: true,
                message: t('customColumns.modal.fieldTitleRequired'),
              },
            ]}
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

        {/* render form items based on types  */}
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
              <Button type="primary" htmlType="submit">
                {t('customColumns.modal.createButton')}
              </Button>
            ) : (
              <Button type="primary" htmlType="submit">
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
