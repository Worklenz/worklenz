import React from 'react';
import type { IProjectStatus } from '@/types/project/projectStatus.types';

interface UseImportDerivedDataArgs {
  fieldMappings: Record<string, string>;
  csvRows: Record<string, any>[];
  csvColumns: string[];
  worklenzStatuses: IProjectStatus[];
  defaultWorkTypes: IProjectStatus[];
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
  fieldMappingRows: Array<{ source_field: string; target_field: string; required?: boolean; include?: boolean }>;
  integrationType: 'direct' | 'csv';
  hierarchyRows: Array<{ source_level: string; target_level: string; position?: number }>;
}

export const useImportDerivedData = ({
  fieldMappings,
  csvRows,
  csvColumns,
  worklenzStatuses,
  defaultWorkTypes,
  t,
  fieldMappingRows,
  integrationType,
  hierarchyRows,
}: UseImportDerivedDataArgs) => {
  const statusColumnKey = React.useMemo(
    () => Object.entries(fieldMappings).find(([, target]) => target === 'status')?.[0],
    [fieldMappings]
  );

  const statusValues = React.useMemo(() => {
    if (!statusColumnKey) return [] as string[];
    const values = new Set<string>();
    csvRows.forEach(row => {
      const raw = row?.[statusColumnKey];
      if (typeof raw === 'string' && raw.trim()) values.add(raw.trim());
    });
    return Array.from(values);
  }, [csvRows, statusColumnKey]);

  const statusOptions = React.useMemo(() => {
    // For CSV import, a new project is created with default statuses — don't show
    // existing workspace statuses (which may include "Cancelled", "Blocked", etc.)
    const sourceStatuses =
      integrationType === 'csv'
        ? defaultWorkTypes
        : worklenzStatuses.length
          ? worklenzStatuses
          : defaultWorkTypes;
    return sourceStatuses.map(status => ({
      key: status.id || status.name || 'status',
      label: status.name || t('importStep.statusFallback', 'Status'),
      icon: React.createElement('span', {
        style: {
          width: 10,
          height: 10,
          display: 'inline-block',
          borderRadius: '50%',
          background: status.color_code || '#64748b',
        },
      }),
      level: typeof status.sort_order === 'number' ? status.sort_order : 0,
    }));
  }, [defaultWorkTypes, integrationType, t, worklenzStatuses]);

  const csvUserRows = React.useMemo(() => {
    if (!csvColumns.length || !csvRows.length) return [] as string[];
    const userColumnKeywords = ['assignee', 'reporter', 'email', 'user', 'username'];
    const userColumns = csvColumns.filter(col =>
      userColumnKeywords.some(keyword => col.toLowerCase().includes(keyword))
    );
    if (!userColumns.length) return [] as string[];

    const usersSet = new Set<string>();
    csvRows.forEach(row => {
      userColumns.forEach(col => {
        const raw = row?.[col];
        if (typeof raw !== 'string') return;
        raw
          .split(/[;,]/)
          .map(v => v.trim())
          .filter(Boolean)
          .forEach(v => usersSet.add(v));
      });
    });

    return Array.from(usersSet);
  }, [csvColumns, csvRows]);

  const mappedFieldCount = React.useMemo(
    () => fieldMappingRows.filter(row => row.include !== false).length,
    [fieldMappingRows]
  );

  const modalDims = React.useMemo(() => {
    if (integrationType === 'csv') {
      return {
        width: 1180,
        stepperMaxWidth: 1120,
      };
    }

    return { width: 900, stepperMaxWidth: 820 };
  }, [integrationType]);

  const hierarchyCount = React.useMemo(() => hierarchyRows.length, [hierarchyRows]);
  const hierarchyDisplayRows = React.useMemo(
    () => [...hierarchyRows].sort((a, b) => (a.position || 0) - (b.position || 0)),
    [hierarchyRows]
  );

  return {
    statusColumnKey,
    statusValues,
    statusOptions,
    csvUserRows,
    mappedFieldCount,
    modalDims,
    hierarchyCount,
    hierarchyDisplayRows,
  };
};
