// import {ActionCompleteArgs, IGanttData} from "@syncfusion/ej2-angular-gantt";
//
// export interface IGanttRoadMapTask {
//   EndDate: string | null
//   StartDate: string | null;
//   subtasks: Subtask[];
//   TaskID: string;
//   TaskName: string;
// }
//
// export interface Subtask {
//   Duration: number;
//   EndDate: string | null;
//   Progress: number;
//   StartDate: string | null;
//   TaskID: number;
//   TaskName: string;
// }
//
// export interface IGanttRow extends IGanttData {
//   TaskID?: string;
//   project_member?: boolean;
// }
//
// export interface IActionCompletedExt extends ActionCompleteArgs {
//   dropIndex?: number;
//   dropRecord: any;
//   fromIndex: number;
//   taskBarEditAction?: string;
// }
//
// export interface IEventMarker {
//   label?: string;
//   day?: Date | string;
// }
//
// export enum IGanttActions {
//   CELL_EDITING = 'CellEditing',
//   TASKBAR_EDITING = 'TaskbarEditing'
// }
//
// export enum IGanttRequestTypes {
//   SAVE = 'save',
//   BEFORE_OPEN_ADD_DIALOG = 'beforeOpenAddDialog',
//   BEFORE_OPEN_EDIT_DIALOG = 'beforeOpenEditDialog',
//   ROW_DROPPED = 'rowDropped'
// }
//
// export enum ITaskbarEditActions {
//   RIGHT_RESIZE = 'RightResizing',
//   LEFT_RESIZE = 'LeftResizing',
//   CHILD_DRAG = 'ChildDrag'
// }
//
// export interface IProjectPhaseLabel {
//   phase_label?: string | null;
// }
