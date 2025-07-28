import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

// Add a simple circular progress component
const TaskProgressCircle: React.FC<{ task: IProjectTask; size?: number }> = ({
  task,
  size = 28,
}) => {
  const progress =
    typeof task.complete_ratio === 'number'
      ? task.complete_ratio
      : typeof task.progress === 'number'
        ? task.progress
        : 0;
  const strokeWidth = 1.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={progress === 100 ? '#22c55e' : '#3b82f6'}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.3s' }}
      />
      {progress === 100 ? (
        // Green checkmark icon
        <g>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="#22c55e" opacity="0.15" />
          <svg
            x={size / 2 - size * 0.22}
            y={size / 2 - size * 0.22}
            width={size * 0.44}
            height={size * 0.44}
            viewBox="0 0 24 24"
          >
            <path
              d="M5 13l4 4L19 7"
              stroke="#22c55e"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </g>
      ) : (
        progress > 0 && (
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={size * 0.38}
            fill="#3b82f6"
            fontWeight="bold"
          >
            {Math.round(progress)}
          </text>
        )
      )}
    </svg>
  );
};

export default TaskProgressCircle;
