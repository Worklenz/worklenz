import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ApartmentOutlined,
  Button,
  Divider,
  Flex,
  Form,
  Input,
  message,
  Select,
  Tooltip,
  Typography,
  Popconfirm,
  theme,
  DeleteOutlined,
  EyeInvisibleOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import SelectionTypeColumn from './selection-type-column/selection-type-column';
import { DependentSelectionTypeColumn } from './dependent-selection-type-column/dependent-selection-type-column';
import { NewParentFieldEditor } from './dependent-selection-type-column/new-parent-field-editor';
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
  setParentColumnId,
  setNewParentField,
  NEW_PARENT_COLUMN_ID,
  setLabelsList,
  resetCustomFieldValues,
} from '@features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { PhaseColorCodes } from '@/shared/constants';
import { selectCustomColumns } from '@/features/task-management/task-management.selectors';
import { ITaskCustomColumn } from '@/types/tasks/task.types';
import {
  findParentColumn,
  getEligibleParentColumns,
  parseDependsOnTypeValue,
  toDependsOnTypeValue,
} from '@/utils/cascading-selection';
import { getTaskCustomFieldDisplayName } from '@/utils/task-custom-columns';
import CustomColumnHeader from '../custom-column-header/custom-column-header';
import { nanoid } from '@reduxjs/toolkit';
import {
  CustomTableColumnsType,
  deleteCustomColumn as deleteCustomColumnFromColumns,
} from '@features/projects/singleProject/taskListColumns/taskColumnsSlice';
import KeyTypeColumn from './key-type-column/key-type-column';
import logger from '@/utils/errorLogger';
import {
  fetchTasksV3,
  fetchTaskListColumns,
  addCustomColumn,
  deleteCustomColumn as deleteCustomColumnFromTaskManagement,
  toggleColumnVisibility as toggleColumnVisibilityV2,
} from '@/features/task-management/task-management.slice';
import { tasksCustomColumnsService } from '@/api/tasks/tasks-custom-columns.service';
import { ExclamationCircleFilled } from '@/shared/antd-imports';
import { toggleColumnVisibility, updateCustomColumnPinned } from '@/features/tasks/tasks.slice';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useCustomColumnVisibility } from '@/hooks/useCustomColumnVisibility';

const NO_PARENT_VALUE = '__none__';

interface CustomColumnFormContentProps {
  projectId?: string;
  onDone: () => void;
}

/**
 * The add/edit custom-column form, extracted from CustomColumnModal so it can
 * be rendered inline (no popup Modal) — e.g. inside the project settings modal's
 * Custom Columns section. `onDone` is called after a successful save/delete/cancel
 * so the caller can switch back to a list view.
 */
const CustomColumnFormContent = ({ projectId, onDone }: CustomColumnFormContentProps) => {
  const [mainForm] = Form.useForm();
  const { t } = useTranslation('task-list-table');
  const { socket } = useSocket();
  const { token } = theme.useToken();

  const dispatch = useAppDispatch();

  const {
    customColumnId,
    customColumnModalType,
    currentColumnData,
    canChangeColumnType,
    decimals,
    label,
    labelPosition,
    previewValue,
    expression,
    firstNumericColumn,
    secondNumericColumn,
    labelsList,
    selectionsList,
    parentColumnId,
    newParentField,
    customFieldType,
  } = useAppSelector(state => state.taskListCustomColumnsReducer);
  const projectCustomColumns = useAppSelector(selectCustomColumns) as ITaskCustomColumn[];

  const fieldType: CustomFieldsTypes = useAppSelector(
    state => state.taskListCustomColumnsReducer.customFieldType
  );
  const numberType: CustomFieldNumberTypes = useAppSelector(
    state => state.taskListCustomColumnsReducer.customFieldNumberType
  );

  const openedColumn = currentColumnData;
  const isEditMode = customColumnModalType === 'edit';
  const isTypeChangeAllowed = !isEditMode || canChangeColumnType;
  const originalFieldType =
    (openedColumn?.custom_column_obj?.fieldType as CustomFieldsTypes | undefined) || customFieldType;
  const { isHidden, toggleVisibility } = useCustomColumnVisibility();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFieldTypeDropdownOpen, setIsFieldTypeDropdownOpen] = useState(isTypeChangeAllowed);

  const editingColumnUuid: string | null = isEditMode
    ? customColumnId || openedColumn?.uuid || null
    : null;
  const eligibleParentColumns = useMemo(
    () => getEligibleParentColumns(projectCustomColumns || [], editingColumnUuid),
    [projectCustomColumns, editingColumnUuid]
  );
  const selectedParentColumn = useMemo((): ITaskCustomColumn | null => {
    if (!parentColumnId || parentColumnId === NEW_PARENT_COLUMN_ID) return null;
    return (projectCustomColumns || []).find(column => column.id === parentColumnId) || null;
  }, [projectCustomColumns, parentColumnId]);
  const dependentColumnNames = useMemo(
    () =>
      editingColumnUuid
        ? (projectCustomColumns || [])
          .filter(
            column =>
              findParentColumn(column, projectCustomColumns || [])?.id === editingColumnUuid
          )
          .map(getTaskCustomFieldDisplayName)
        : [],
    [projectCustomColumns, editingColumnUuid]
  );
  const hasDependentColumns = dependentColumnNames.length > 0;
  // "+ Create new parent field" only creates a standalone parent column (no child in this step).
  const isCreatingNewParent = parentColumnId === NEW_PARENT_COLUMN_ID;
  const isDependentSelection =
    customFieldType === 'selection' && !!parentColumnId && !isCreatingNewParent;

  // In edit mode, stash the opened column's options while drafting a new parent so Cancel /
  // switching away can restore them without touching the opened column.
  const stashedSelectionsRef = useRef<typeof selectionsList | null>(null);

  const selectParentColumn = (nextParentColumnId: string | null) => {
    const isNextNew = nextParentColumnId === NEW_PARENT_COLUMN_ID;
    if (isNextNew && !newParentField) {
      dispatch(
        setNewParentField({
          name: '',
          selections: [{ selection_id: nanoid(), selection_name: '', selection_color: PhaseColorCodes[0] }],
        })
      );
    }
    if (isEditMode) {
      if (isNextNew && parentColumnId !== NEW_PARENT_COLUMN_ID) {
        stashedSelectionsRef.current = selectionsList;
        dispatch(setSelectionsList([]));
      } else if (!isNextNew && parentColumnId === NEW_PARENT_COLUMN_ID) {
        dispatch(setSelectionsList(stashedSelectionsRef.current || []));
        stashedSelectionsRef.current = null;
        dispatch(setNewParentField(null));
      }
    }
    dispatch(setParentColumnId(nextParentColumnId));
  };

  const handleFieldTypeChange = (selectedValue: string) => {
    const dependsOnColumnId = parseDependsOnTypeValue(selectedValue);
    dispatch(setCustomFieldType(dependsOnColumnId ? 'selection' : (selectedValue as CustomFieldsTypes)));
    selectParentColumn(dependsOnColumnId);
    mainForm.setFieldValue('fieldType', selectedValue);
  };

  /** Creates the inline "new parent field" column and returns its id, or null on failure. */
  const createNewParentColumn = async (): Promise<string | null> => {
    const parentName = newParentField?.name.trim() || '';
    const parentSelections = (newParentField?.selections || []).filter(
      selection => selection.selection_name.trim() !== ''
    );

    if (!parentName || parentSelections.length === 0) {
      message.error(
        t('customColumns.dependentSelection.newParentIncomplete', {
          defaultValue: 'Give the new parent field a title and at least one option.',
        })
      );
      return null;
    }

    const res = await tasksCustomColumnsService.createCustomColumn(projectId || '', {
      name: parentName,
      key: nanoid(),
      field_type: 'selection',
      width: 120,
      is_visible: true,
      configuration: {
        field_title: parentName,
        field_type: 'selection',
        parent_column_id: null,
        selections_list: parentSelections.map((selection, index) => ({
          selection_id: selection.selection_id,
          selection_name: selection.selection_name.trim(),
          selection_color: selection.selection_color,
          selection_order: index,
        })),
        labels_list: [],
      },
    });

    if (!res.done || !res.body?.id) {
      if (res.message) message.error(res.message);
      return null;
    }

    socket?.emit(SocketEvents.CUSTOM_COLUMN_CREATED.toString(), JSON.stringify({ project_id: projectId }));
    return res.body.id as string;
  };

  const resetModalData = () => {
    mainForm.resetFields();
    dispatch(resetCustomFieldValues());
    dispatch(setCustomColumnModalAttributes({ modalType: 'create', columnId: null }));
  };

  // Prefill form + redux field-type state when opened for editing (mirrors the
  // Modal's previous afterOpenChange behavior, but runs on mount instead).
  useEffect(() => {
    if (isEditMode && openedColumn) {
      dispatch(setCustomFieldType(openedColumn.custom_column_obj?.fieldType || 'people'));
      dispatch(setParentColumnId(null));

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
        dispatch(setParentColumnId(openedColumn.custom_column_obj?.parentColumnId || null));
      } else if (openedColumn.custom_column_obj?.fieldType === 'labels') {
        if (Array.isArray(openedColumn.custom_column_obj?.labelsList)) {
          dispatch(setLabelsList(openedColumn.custom_column_obj.labelsList));
        }
      }

      const openedParentColumnId =
        openedColumn.custom_column_obj?.fieldType === 'selection'
          ? openedColumn.custom_column_obj?.parentColumnId
          : null;

      mainForm.setFieldsValue({
        fieldTitle: openedColumn.name || openedColumn.custom_column_obj?.fieldTitle,
        fieldType: openedParentColumnId
          ? toDependsOnTypeValue(openedParentColumnId)
          : openedColumn.custom_column_obj?.fieldType,
        numberType: openedColumn.custom_column_obj?.numberType,
        decimals: openedColumn.custom_column_obj?.decimals,
        label: openedColumn.custom_column_obj?.label,
        labelPosition: openedColumn.custom_column_obj?.labelPosition,
        previewValue: openedColumn.custom_column_obj?.previewValue,
        expression: openedColumn.custom_column_obj?.expression,
        firstNumericColumn: openedColumn.custom_column_obj?.firstNumericColumn,
        secondNumericColumn: openedColumn.custom_column_obj?.secondNumericColumn,
      });
    } else {
      resetModalData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customColumnModalType, customColumnId, openedColumn?.key]);

  const handleDeleteColumn = async () => {
    const columnUUID =
      customColumnId ||
      openedColumn?.uuid ||
      openedColumn?.id ||
      openedColumn?.custom_column_obj?.uuid ||
      openedColumn?.custom_column_obj?.id;

    if (!customColumnId || !columnUUID) {
      return;
    }

    try {
      await tasksCustomColumnsService.deleteCustomColumn(columnUUID);
      dispatch(deleteCustomColumnFromTaskManagement(customColumnId));
      dispatch(deleteCustomColumnFromColumns(customColumnId));
      resetModalData();

      if (projectId) {
        dispatch(fetchTaskListColumns(projectId));
        dispatch(fetchTasksV3(projectId));
      }
      onDone();
    } catch (error) {
      logger.error('Error deleting custom column:', error);
    }
  };

  // Always hides the column — never toggles back to visible from this button.
  // Use the Fields dropdown (Show Fields) to make a hidden column visible again.
  const handleHideColumn = () => {
    if (!customColumnId || !openedColumn) return;

    const col = openedColumn;
    const colKey = col.key as string | undefined;
    const colUUID: string = (col as any).uuid || customColumnId;

    if (!isHidden(colUUID)) {
      toggleVisibility(colUUID);
    }

    dispatch(
      updateCustomColumnPinned({
        columnId: colUUID,
        columnKey: colKey,
        isVisible: false,
      })
    );

    if (colKey) {
      dispatch(toggleColumnVisibility(colKey));
      dispatch(toggleColumnVisibilityV2(colKey));
    }

    socket?.emit(SocketEvents.CUSTOM_COLUMN_PINNED_CHANGE.toString(), {
      column_id: colUUID,
      project_id: projectId,
      is_visible: false,
    });

    resetModalData();
    onDone();
  };

  const fieldTypesOptions = [
    { key: 'people', value: 'people', label: t('customColumns.fieldTypes.people'), disabled: false },
    { key: 'text', value: 'text', label: t('customColumns.fieldTypes.text'), disabled: false },
    { key: 'number', value: 'number', label: t('customColumns.fieldTypes.number'), disabled: false },
    { key: 'date', value: 'date', label: t('customColumns.fieldTypes.date'), disabled: false },
    { key: 'selection', value: 'selection', label: t('customColumns.fieldTypes.selection'), disabled: false },
  ];

  const dependsOnTypeOptions = eligibleParentColumns.map(column => ({
    key: toDependsOnTypeValue(column.id),
    value: toDependsOnTypeValue(column.id),
    title: getTaskCustomFieldDisplayName(column),
    label: (
      <Flex align="center" gap={6} style={{ minWidth: 0 }}>
        <ApartmentOutlined style={{ color: token.colorTextSecondary }} />
        <span className="truncate">{getTaskCustomFieldDisplayName(column)}</span>
      </Flex>
    ),
  }));

  const createNewParentLabel = t('customColumns.dependentSelection.createNewParent', {
    defaultValue: '+ Create new parent field',
  });
  if (!hasDependentColumns) {
    dependsOnTypeOptions.unshift({
      key: toDependsOnTypeValue(NEW_PARENT_COLUMN_ID),
      value: toDependsOnTypeValue(NEW_PARENT_COLUMN_ID),
      title: createNewParentLabel,
      label: (
        <Flex align="center" gap={6} style={{ minWidth: 0, color: token.colorPrimary }}>
          <span className="truncate">{createNewParentLabel}</span>
        </Flex>
      ),
    });
  }

  const typeSelectOptions = [
    ...fieldTypesOptions,
    ...(dependsOnTypeOptions.length > 0
      ? [
        {
          label: t('customColumns.dependentSelection.typeGroup', {
            defaultValue: 'Depends on selection',
          }),
          title: t('customColumns.dependentSelection.typeGroup', {
            defaultValue: 'Depends on selection',
          }),
          options: dependsOnTypeOptions,
        },
      ]
      : []),
  ];

  const buildSelectionsPayload = (fieldTypeValue: string, effectiveParentId: string | null) => {
    if (fieldTypeValue !== 'selection') return [];
    return selectionsList
      .filter(selection => selection.selection_name.trim() !== '')
      .map((selection, index) => ({
        selection_id: selection.selection_id,
        selection_name: selection.selection_name.trim(),
        selection_color: selection.selection_color,
        selection_order: index,
        parent_selection_id: effectiveParentId ? selection.parent_selection_id || null : null,
      }));
  };

  /**
   * "+ Create new parent field": creates only the standalone parent Selection column.
   * Child columns are added later via Depends on → this parent.
   */
  const createNewParentOnly = async () => {
    try {
      const newParentId = await createNewParentColumn();
      if (!newParentId) {
        setIsSubmitting(false);
        return;
      }

      stashedSelectionsRef.current = null;
      resetModalData();
      message.success(t('customColumns.modal.createSuccessMessage'));
      if (projectId) {
        dispatch(fetchTaskListColumns(projectId));
        dispatch(fetchTasksV3(projectId));
      }
      setIsSubmitting(false);
      onDone();
    } catch (error) {
      logger.error('Error creating parent custom column:', error);
      message.error(t('customColumns.modal.createErrorMessage'));
      if (projectId) dispatch(fetchTaskListColumns(projectId));
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (formValue: any) => {
    if (isSubmitting) return;
    // The Type dropdown encodes "Selection that depends on <column>" as its own value.
    const value = {
      ...formValue,
      fieldType: parseDependsOnTypeValue(formValue.fieldType) ? 'selection' : formValue.fieldType,
    };
    setIsSubmitting(true);

    const resolvedTypeForParent = isEditMode && !canChangeColumnType ? originalFieldType : value.fieldType;
    const effectiveParentId: string | null =
      resolvedTypeForParent === 'selection' && parentColumnId !== NEW_PARENT_COLUMN_ID
        ? parentColumnId
        : null;

    if (isCreatingNewParent) {
      await createNewParentOnly();
      return;
    }

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
            parentColumnId: effectiveParentId,
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
          parent_column_id: effectiveParentId,
          selections_list: buildSelectionsPayload(value.fieldType, effectiveParentId),
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
            socket?.emit(SocketEvents.CUSTOM_COLUMN_CREATED.toString(), JSON.stringify({ project_id: projectId }));
            resetModalData();
            message.success(t('customColumns.modal.createSuccessMessage'));

            if (projectId) {
              dispatch(fetchTaskListColumns(projectId));
              dispatch(fetchTasksV3(projectId));
            }
            setIsSubmitting(false);
            onDone();
          }
        } catch (error) {
          logger.error('Error creating custom column:', error);
          message.error(t('customColumns.modal.createErrorMessage'));
          setIsSubmitting(false);
        }
      } else if (isEditMode && customColumnId) {
        const updateColumnUUID =
          customColumnId ||
          openedColumn?.uuid ||
          openedColumn?.id ||
          openedColumn?.custom_column_obj?.uuid ||
          openedColumn?.custom_column_obj?.id;

        if (updateColumnUUID) {
          try {
            const resolvedFieldType = canChangeColumnType ? value.fieldType : originalFieldType;
            const configuration = {
              field_title: value.fieldTitle,
              field_type: resolvedFieldType,
              number_type: value.numberType,
              decimals: value.decimals,
              label: value.label,
              label_position: value.labelPosition,
              preview_value: value.previewValue,
              expression: value.expression,
              first_numeric_column_key: value.firstNumericColumn?.key,
              second_numeric_column_key: value.secondNumericColumn?.key,
              parent_column_id: resolvedFieldType === 'selection' ? effectiveParentId : null,
              selections_list: buildSelectionsPayload(
                resolvedFieldType,
                resolvedFieldType === 'selection' ? effectiveParentId : null
              ),
              labels_list:
                resolvedFieldType === 'labels'
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
              field_type: resolvedFieldType,
              width: 150,
              is_visible: true,
              configuration,
              lock_field_type: true,
            });

            resetModalData();

            if (projectId) {
              dispatch(fetchTaskListColumns(projectId));
              dispatch(fetchTasksV3(projectId));
            }
            setIsSubmitting(false);
            onDone();
          } catch (error) {
            logger.error('Error updating custom column:', error);
            setIsSubmitting(false);
          }
        }
      }

      mainForm.resetFields();
    } catch (error) {
      logger.error('error in custom column form', error);
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetModalData();
    onDone();
  };

  return (
    <div>
      <Form
        form={mainForm}
        layout="vertical"
        onFinish={handleFormSubmit}
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
        <Flex gap={16}>
          {!isCreatingNewParent && (
            <Form.Item
              name={'fieldTitle'}
              label={<Typography.Text>{t('customColumns.modal.fieldTitle')}</Typography.Text>}
              layout="vertical"
              rules={[{ required: true, message: t('customColumns.modal.fieldTitleRequired') }]}
              required={false}
              style={{ flex: 1, minWidth: 0 }}
            >
              <Input placeholder={t('customColumns.modal.columnTitlePlaceholder')} />
            </Form.Item>
          )}

          <Form.Item
            name={'fieldType'}
            label={<Typography.Text>{t('customColumns.modal.type')}</Typography.Text>}
            layout="vertical"
            style={{ width: isCreatingNewParent ? '100%' : 180, flexShrink: 0 }}
            extra={
              isEditMode && !canChangeColumnType ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('customColumns.modal.typeCannotBeChanged', {
                    defaultValue: 'Column type cannot be changed after creation.',
                  })}
                </Typography.Text>
              ) : undefined
            }
          >
            {isEditMode && !canChangeColumnType ? (
              <Typography.Text aria-readonly="true">
                {t(`customColumns.fieldTypes.${originalFieldType}`, {
                  defaultValue: originalFieldType,
                })}
              </Typography.Text>
            ) : (
              <Select
                options={typeSelectOptions}
                listHeight={420}
                onChange={handleFieldTypeChange}
                open={isFieldTypeDropdownOpen}
                onOpenChange={setIsFieldTypeDropdownOpen}
                popupMatchSelectWidth={false}
              />
            )}
          </Form.Item>
        </Flex>

        {isEditMode && !canChangeColumnType && originalFieldType === 'selection' && (
          <Form.Item
            label={
              <Typography.Text>
                {t('customColumns.dependentSelection.dependsOn', { defaultValue: 'Depends on' })}
              </Typography.Text>
            }
            extra={
              hasDependentColumns ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('customColumns.dependentSelection.hasDependentsHint', {
                    defaultValue: '{{fields}} depends on this field, so it cannot depend on another field.',
                    fields: dependentColumnNames.join(', '),
                  })}
                </Typography.Text>
              ) : undefined
            }
          >
            <Select
              value={parentColumnId || NO_PARENT_VALUE}
              disabled={hasDependentColumns}
              onChange={selectedValue =>
                selectParentColumn(selectedValue === NO_PARENT_VALUE ? null : selectedValue)
              }
              options={[
                {
                  value: NO_PARENT_VALUE,
                  label: t('customColumns.dependentSelection.none', { defaultValue: 'None' }),
                },
                ...eligibleParentColumns.map(column => ({
                  value: column.id,
                  label: getTaskCustomFieldDisplayName(column),
                })),
                {
                  value: NEW_PARENT_COLUMN_ID,
                  label: (
                    <span style={{ color: token.colorPrimary }}>{createNewParentLabel}</span>
                  ),
                },
              ]}
            />
          </Form.Item>
        )}

        {customFieldType === 'key' && <KeyTypeColumn />}
        {customFieldType === 'number' && <NumberTypeColumn />}
        {customFieldType === 'formula' && <FormulaTypeColumn />}
        {customFieldType === 'labels' && <LabelTypeColumn />}
        {isCreatingNewParent && (
          <Flex vertical gap={8}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('customColumns.dependentSelection.newParentOnlyHint', {
                defaultValue:
                  'Creates a main Selection column only. Add a child column later and set Depends on to this field.',
              })}
            </Typography.Text>
            <NewParentFieldEditor />
          </Flex>
        )}
        {customFieldType === 'selection' && !isDependentSelection && !isCreatingNewParent && (
          <SelectionTypeColumn />
        )}
        {isDependentSelection && <DependentSelectionTypeColumn parentColumn={selectedParentColumn} />}

        <Divider style={{ margin: '20px 0 16px' }} />

        <Flex align="center" justify="space-between">
          <div>
            {customColumnModalType === 'edit' && customColumnId && (
              <Flex gap={8}>
                <Tooltip
                  title={t('customColumns.modal.hideFromTaskList', {
                    defaultValue: 'Hide from task list',
                  })}
                >
                  <Button
                    size="small"
                    type="text"
                    aria-label={t('customColumns.modal.hideFromTaskList', {
                      defaultValue: 'Hide from task list',
                    })}
                    icon={<EyeInvisibleOutlined />}
                    onClick={handleHideColumn}
                  />
                </Tooltip>

                {hasDependentColumns ? (
                  <Tooltip
                    title={t('customColumns.dependentSelection.deleteBlocked', {
                      defaultValue:
                        "Can't delete this field because {{fields}} depends on it. Remove that dependency first.",
                      fields: dependentColumnNames.join(', '),
                    })}
                  >
                    <Button
                      size="small"
                      type="text"
                      danger
                      disabled
                      aria-label={t('customColumns.modal.deleteButton')}
                      icon={<DeleteOutlined />}
                    />
                  </Tooltip>
                ) : (
                  <Popconfirm
                    title={t('customColumns.modal.deleteConfirmTitle')}
                    description={t('customColumns.modal.deleteConfirmDescription')}
                    icon={<ExclamationCircleFilled style={{ color: token.colorError }} />}
                    onConfirm={handleDeleteColumn}
                    okText={t('customColumns.modal.deleteButton')}
                    cancelText={t('customColumns.modal.cancelButton')}
                    okButtonProps={{ danger: true }}
                  >
                    <Tooltip title={t('customColumns.modal.deleteButton')}>
                      <Button
                        size="small"
                        type="text"
                        danger
                        aria-label={t('customColumns.modal.deleteButton')}
                        icon={<DeleteOutlined />}
                      />
                    </Tooltip>
                  </Popconfirm>
                )}
              </Flex>
            )}
          </div>

          <Flex gap={8}>
            <Button size="small" onClick={handleCancel}>
              {t('customColumns.modal.cancelButton')}
            </Button>
            <Button
              type="primary"
              size="small"
              htmlType="submit"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {customColumnModalType === 'create'
                ? t('customColumns.modal.createButton')
                : t('customColumns.modal.updateButton')}
            </Button>
          </Flex>
        </Flex>
      </Form>
    </div>
  );
};

export default CustomColumnFormContent;
