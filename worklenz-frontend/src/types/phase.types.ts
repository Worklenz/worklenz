export type PhaseOption = {
  optionId: string;
  optionName: string;
  optionColor: string;
};

export type PhaseType = {
  phaseId: string;
  projectId: string;
  phase: string;
  phaseOptions: PhaseOption[];
};
