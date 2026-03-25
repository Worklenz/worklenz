import React, { memo } from 'react';
import { Flex, Skeleton } from '@/shared/antd-imports';

const TAB_LABELS = [
  'Task List',
  'Board',
  'Insights',
  'Files',
  'Members',
  'Updates',
  'Roadmap',
  'Workload',
];

const SKELETON_GROUPS = [{ rows: 3 }, { rows: 4 }, { rows: 2 }];

const SkeletonRow: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      height: 42,
      borderBottom: '1px solid var(--ant-color-border)',
      gap: 24,
      paddingInline: 24,
    }}
  >
    <Skeleton.Button size="small" shape="square" active style={{ width: 28, minWidth: 28 }} />
    <Skeleton.Input active size="small" style={{ width: 280 }} />
    <Skeleton.Button active size="small" style={{ width: 80 }} />
    <Skeleton.Button active size="small" style={{ width: 70 }} />

    <Skeleton.Button size="small" shape="circle" active style={{ width: 28, minWidth: 28 }} />
    <Skeleton.Avatar size="small" active />
    <Skeleton.Avatar size="small" active />
    <Skeleton.Button active size="small" style={{ width: 200 }} />
    <Skeleton.Button active size="small" style={{ width: 150 }} />
    <Skeleton.Button active size="small" style={{ width: 150 }} />
    <Skeleton.Button active size="small" style={{ width: 80 }} />
    <Skeleton.Button active size="small" style={{ width: 110 }} />
  </div>
);

const SkeletonGroup: React.FC<{ rows: number }> = ({ rows }) => (
  <div style={{ marginTop: 20 }}>
    {/* Group header */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        borderRadius: 4,
        marginBottom: 6,
        background: 'var(--ant-color-fill-quaternary)',
      }}
    >
      <Skeleton.Button size="small" shape="circle" active style={{ width: 20, minWidth: 20 }} />
      <Skeleton.Input active size="small" style={{ width: 170 }} />
      <Skeleton.Button active size="small" style={{ width: 42 }} />
    </div>
    {/* Task rows */}
    {Array.from({ length: rows }, (_, i) => (
      <SkeletonRow key={i} />
    ))}
  </div>
);

const ProjectViewSkeleton: React.FC = memo(() => {
  return (
    <div style={{ marginBlockEnd: 12, minHeight: '80vh', paddingTop: 24 }}>
      {/* Header skeleton */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '8px 0',
          marginBottom: 4,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Flex align="center" gap={12}>
          <Skeleton.Button active size="small" shape="circle" style={{ width: 28, minWidth: 28 }} />
          <Skeleton.Input active size="small" style={{ width: 110 }} />
          <span style={{ color: 'var(--ant-color-text-quaternary)' }}>/</span>
          <Skeleton.Input active size="small" style={{ width: 240 }} />
          <Skeleton.Button active size="small" style={{ width: 90 }} />
        </Flex>
        <Flex gap={12}>
          <Skeleton.Button active size="small" style={{ width: 120 }} />
          <Skeleton.Button active size="small" style={{ width: 110 }} />
          <Skeleton.Button active size="small" style={{ width: 44 }} />
          <Skeleton.Button active size="small" style={{ width: 44 }} />
        </Flex>
      </div>

      {/* Tab bar skeleton */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--ant-color-border)',
          paddingBottom: 0,
          marginBottom: 16,
        }}
      >
        {TAB_LABELS.map(label => (
          <div
            key={label}
            style={{
              padding: '8px 12px',
              fontSize: 13,
              color: 'var(--ant-color-text-quaternary)',
              borderBottom:
                label === 'Task List'
                  ? '2px solid var(--ant-color-primary)'
                  : '2px solid transparent',
              marginBottom: -1,
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Filters bar skeleton */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
        <Skeleton.Button active size="small" style={{ width: 110 }} />
        <Skeleton.Button active size="small" style={{ width: 110 }} />
        <Skeleton.Button active size="small" style={{ width: 110 }} />
        <Skeleton.Button active size="small" style={{ width: 90 }} />
      </div>

      {/* Column headers skeleton */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 40,
          background: 'var(--ant-color-fill-quaternary)',
          borderRadius: '4px 4px 0 0',
          padding: '0 8px',
          gap: 8,
          borderBottom: '1px solid var(--ant-color-border)',
        }}
      >
        <Skeleton.Button size="small" shape="circle" active style={{ width: 20, minWidth: 20 }} />
        <Skeleton.Input active size="small" style={{ width: 280 }} />
        <Skeleton.Button active size="small" style={{ width: 110 }} />
        <Skeleton.Button active size="small" style={{ width: 110 }} />
        <Skeleton.Button active size="small" style={{ width: 120 }} />
        <Skeleton.Button active size="small" style={{ width: 120 }} />
        <Skeleton.Button active size="small" style={{ width: 110 }} />
      </div>

      {/* Task groups skeleton */}
      {SKELETON_GROUPS.map((group, i) => (
        <SkeletonGroup key={i} rows={group.rows} />
      ))}
    </div>
  );
});

ProjectViewSkeleton.displayName = 'ProjectViewSkeleton';

export default ProjectViewSkeleton;
