export const resolveTaskProgress = (task: any): number => {
  const rawProgress =
    typeof task?.progress_value === 'number'
      ? task.progress_value
      : typeof task?.complete_ratio === 'number'
        ? task.complete_ratio
        : 0;

  return Number(rawProgress);
};
