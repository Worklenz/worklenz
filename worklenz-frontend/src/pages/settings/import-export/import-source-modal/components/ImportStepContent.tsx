import React from 'react';
import { message as antdMessage } from '@/shared/antd-imports';
import { updateImportSource } from '@/api/imports';
import type { ImportJob } from '@/api/imports';
import { CsvMappingStepsContent } from './CsvMappingStepsContent';
import { CsvReviewStepContent } from './CsvReviewStepContent';
import { CsvSetupStepsContent } from './CsvSetupStepsContent';
import { DirectIntegrationStepContent } from './DirectIntegrationStepContent';

interface ImportStepContentProps {
  integrationType: 'direct' | 'csv';
  step: number;
  lowerKey: string;
  isJira: boolean;
  authCompleted: boolean;
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
  themeToken: any;
  sourceLabel: string;
  source: { label: string };
  asanaWorkspaces: Array<{ id: string; name: string }>;
  clickupTeams: Array<{
    id: string;
    name: string;
    spaces: Array<{ id: string; name: string; lists: Array<{ id: string; name: string }> }>;
  }>;
  jiraProjects: Array<{ key: string; name: string }>;
  asanaProjects: Array<{ id: string; name: string; workspaceId?: string }>;
  selectedWorkspace: string;
  setSelectedWorkspace: React.Dispatch<React.SetStateAction<string>>;
  setSelectedProject: React.Dispatch<React.SetStateAction<string>>;
  jiraDomain: string;
  selectedBoard: string;
  setSelectedBoard: React.Dispatch<React.SetStateAction<string>>;
  selectedTrelloBoard: string;
  setSelectedTrelloBoard: React.Dispatch<React.SetStateAction<string>>;
  trelloBoards: Array<{ id: string; name: string }>;
  mondayBoards: Array<{ id: string; name: string }>;
  job: ImportJob | null;
  runAutoMapping: (suppressToast?: boolean) => Promise<void>;
  selectedClickupList: string;
  setSelectedClickupList: React.Dispatch<React.SetStateAction<string>>;
  selectedClickupSpace: string;
  selectedJiraProject: string;
  setSelectedJiraProject: React.Dispatch<React.SetStateAction<string>>;
  persistAsanaSelection: (projectId: string, workspaceId?: string, projectName?: string) => Promise<void>;
  selectedProject: string;
  spaceName: string;
  setSpaceName: React.Dispatch<React.SetStateAction<string>>;
  reviewSubScreen: 'main' | 'hierarchy' | 'fieldMapping';
  setReviewSubScreen: React.Dispatch<React.SetStateAction<'main' | 'hierarchy' | 'fieldMapping'>>;
  hierarchyCount: number;
  mappedFieldCount: number;
  fieldMappingRows: Array<{ source_field: string; target_field: string; required?: boolean; include?: boolean }>;
  importMembers: boolean;
  setImportMembers: React.Dispatch<React.SetStateAction<boolean>>;
  importAttachments: boolean;
  setImportAttachments: React.Dispatch<React.SetStateAction<boolean>>;
  hierarchyDisplayRows: Array<{ source_level: string; target_level: string; position?: number }>;
  setHierarchyRows: React.Dispatch<
    React.SetStateAction<Array<{ source_level: string; target_level: string; position?: number }>>
  >;
  worklenzFieldOptions: Array<{ value: string; label: string }>;
  setFieldMappingRows: React.Dispatch<
    React.SetStateAction<
      Array<{ source_field: string; target_field: string; required?: boolean; include?: boolean }>
    >
  >;
  uploadedCsvFileRef: React.MutableRefObject<File | null>;
  parseCsvData: (text: string) => { columnsCount: number; rowsCount: number };
  encoding: string;
  setEncoding: React.Dispatch<React.SetStateAction<string>>;
  delimiter: string;
  setDelimiter: React.Dispatch<React.SetStateAction<string>>;
  csvSettingsOpen: boolean;
  setCsvSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  csvColumns: string[];
  fieldMappings: Record<string, string>;
  setFieldMappings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  includeInImport: Record<string, boolean>;
  setIncludeInImport: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  statusValues: string[];
  searchValue: string;
  setSearchValue: React.Dispatch<React.SetStateAction<string>>;
  filter: string;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  statusColumnKey?: string;
  statusOptions: Array<{ key: string; label: string; icon: React.ReactNode; level: number }>;
  statusValueMapping: Record<string, string>;
  setStatusValueMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  csvUserRows: string[];
  userEmails: Record<string, string>;
  setUserEmails: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  addUsers: boolean;
  setAddUsers: React.Dispatch<React.SetStateAction<boolean>>;
  csvRows: Record<string, any>[];
}

export const ImportStepContent: React.FC<ImportStepContentProps> = props => {
  const {
    integrationType,
    step,
    lowerKey,
    isJira,
    authCompleted,
    t,
    themeToken,
    sourceLabel,
    source,
    asanaWorkspaces,
    clickupTeams,
    jiraProjects,
    asanaProjects,
    selectedWorkspace,
    setSelectedWorkspace,
    setSelectedProject,
    jiraDomain,
    selectedBoard,
    setSelectedBoard,
    selectedTrelloBoard,
    setSelectedTrelloBoard,
    trelloBoards,
    mondayBoards,
    job,
    runAutoMapping,
    selectedClickupList,
    setSelectedClickupList,
    selectedClickupSpace,
    selectedJiraProject,
    setSelectedJiraProject,
    persistAsanaSelection,
    selectedProject,
    spaceName,
    setSpaceName,
    reviewSubScreen,
    setReviewSubScreen,
    hierarchyCount,
    mappedFieldCount,
    fieldMappingRows,
    importMembers,
    setImportMembers,
    importAttachments,
    setImportAttachments,
    hierarchyDisplayRows,
    setHierarchyRows,
    worklenzFieldOptions,
    setFieldMappingRows,
    uploadedCsvFileRef,
    parseCsvData,
    encoding,
    setEncoding,
    delimiter,
    setDelimiter,
    csvSettingsOpen,
    setCsvSettingsOpen,
    csvColumns,
    fieldMappings,
    setFieldMappings,
    includeInImport,
    setIncludeInImport,
    statusValues,
    searchValue,
    setSearchValue,
    filter,
    setFilter,
    statusColumnKey,
    statusOptions,
    statusValueMapping,
    setStatusValueMapping,
    csvUserRows,
    userEmails,
    setUserEmails,
    addUsers,
    setAddUsers,
    csvRows,
  } = props;

  if (integrationType === 'direct') {
    return (
      <DirectIntegrationStepContent
        step={step}
        lowerKey={lowerKey}
        isJira={isJira}
        authCompleted={authCompleted}
        t={t}
        themeToken={themeToken}
        source={source}
        asanaWorkspaces={asanaWorkspaces}
        clickupTeams={clickupTeams}
        jiraProjects={jiraProjects}
        asanaProjects={asanaProjects}
        selectedWorkspace={selectedWorkspace}
        setSelectedWorkspace={setSelectedWorkspace}
        setSelectedProject={setSelectedProject}
        jiraDomain={jiraDomain}
        selectedBoard={selectedBoard}
        setSelectedBoard={setSelectedBoard}
        selectedTrelloBoard={selectedTrelloBoard}
        setSelectedTrelloBoard={setSelectedTrelloBoard}
        trelloBoards={trelloBoards}
        mondayBoards={mondayBoards}
        job={job}
        updateImportSource={updateImportSource}
        runAutoMapping={runAutoMapping}
        message={antdMessage}
        selectedClickupList={selectedClickupList}
        setSelectedClickupList={setSelectedClickupList}
        selectedClickupSpace={selectedClickupSpace}
        selectedJiraProject={selectedJiraProject}
        setSelectedJiraProject={setSelectedJiraProject}
        persistAsanaSelection={persistAsanaSelection}
        selectedProject={selectedProject}
        spaceName={spaceName}
        setSpaceName={setSpaceName}
        reviewSubScreen={reviewSubScreen}
        setReviewSubScreen={setReviewSubScreen}
        hierarchyCount={hierarchyCount}
        mappedFieldCount={mappedFieldCount}
        fieldMappingRows={fieldMappingRows}
        importMembers={importMembers}
        setImportMembers={setImportMembers}
        importAttachments={importAttachments}
        setImportAttachments={setImportAttachments}
        hierarchyDisplayRows={hierarchyDisplayRows}
        setHierarchyRows={setHierarchyRows}
        worklenzFieldOptions={worklenzFieldOptions}
        setFieldMappingRows={setFieldMappingRows}
      />
    );
  }

  switch (step) {
    case 0:
    case 1:
      return (
        <CsvSetupStepsContent
          step={step}
          t={t}
          themeToken={themeToken}
          uploadedCsvFileRef={uploadedCsvFileRef}
          parseCsvData={parseCsvData}
          encoding={encoding}
          setEncoding={setEncoding}
          delimiter={delimiter}
          setDelimiter={setDelimiter}
          csvSettingsOpen={csvSettingsOpen}
          setCsvSettingsOpen={setCsvSettingsOpen}
          sourceLabel={sourceLabel || t('importStep.yourApp', { defaultValue: 'your app' })}
          spaceName={spaceName}
          setSpaceName={setSpaceName}
        />
      );
    case 2:
    case 3:
    case 4:
      return (
        <CsvMappingStepsContent
          step={step}
          t={t}
          themeToken={themeToken}
          csvColumns={csvColumns}
          fieldMappings={fieldMappings}
          setFieldMappings={setFieldMappings}
          includeInImport={includeInImport}
          setIncludeInImport={setIncludeInImport}
          worklenzFieldOptions={worklenzFieldOptions}
          statusValues={statusValues}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          filter={filter}
          setFilter={setFilter}
          statusColumnKey={statusColumnKey}
          statusOptions={statusOptions}
          statusValueMapping={statusValueMapping}
          setStatusValueMapping={setStatusValueMapping}
          csvUserRows={csvUserRows}
          userEmails={userEmails}
          setUserEmails={setUserEmails}
          addUsers={addUsers}
          setAddUsers={setAddUsers}
        />
      );
    case 5:
      return (
        <CsvReviewStepContent
          t={t}
          themeToken={themeToken}
          spaceName={spaceName}
          providerKey={lowerKey}
          sourceLabel={sourceLabel}
          fieldMappings={fieldMappings}
          csvColumns={csvColumns}
          statusValueMapping={statusValueMapping}
          csvUserRows={csvUserRows}
          userEmails={userEmails}
          addUsers={addUsers}
          csvRows={csvRows}
        />
      );
    default:
      return null;
  }
};
