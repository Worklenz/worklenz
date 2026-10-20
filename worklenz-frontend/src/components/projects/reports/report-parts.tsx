import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Col, Empty, Flex, Result, Row, Skeleton, Typography, theme } from '@/shared/antd-imports';

export type ReportNoteTone = 'default' | 'success' | 'warning' | 'danger';

export interface ReportStat {
  key: string;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  noteTone?: ReportNoteTone;
}

/** Row of headline metric cards shown at the top of each report. */
export const ReportStatGrid = ({ stats }: { stats: ReportStat[] }) => (
  <Row gutter={[12, 12]}>
    {stats.map(stat => (
      <Col key={stat.key} xs={24} sm={12} xl={6}>
        <ReportStatCard stat={stat} />
      </Col>
    ))}
  </Row>
);

const ReportStatCard = ({ stat }: { stat: ReportStat }) => {
  const { token } = theme.useToken();
  const noteColor = getNoteColor(stat.noteTone ?? 'default', token);

  return (
    <div
      className="h-full p-4"
      style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 8,
      }}
    >
      <Typography.Text type="secondary" className="block text-xs">
        {stat.label}
      </Typography.Text>
      <div className="text-2xl font-semibold mt-1 truncate" style={{ color: token.colorText }}>
        {stat.value}
      </div>
      {stat.note && (
        <div className="text-xs mt-1" style={{ color: noteColor }}>
          {stat.note}
        </div>
      )}
    </div>
  );
};

interface ReportPanelProps {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
}

/** Bordered container for a chart or breakdown. */
export const ReportPanel = ({ title, extra, children }: ReportPanelProps) => {
  const { token } = theme.useToken();

  return (
    <section
      className="h-full p-4 flex flex-col gap-3"
      style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 8,
      }}
      aria-label={title}
    >
      <Flex align="center" gap={8} wrap="wrap">
        <Typography.Text strong className="text-sm">
          {title}
        </Typography.Text>
        {extra && <div className="ml-auto">{extra}</div>}
      </Flex>
      {children}
    </section>
  );
};

/** Fixed-height wrapper so charts keep a stable layout while resizing. */
export const ReportChartArea = ({ children }: { children: ReactNode }) => (
  <div className="relative w-full h-[260px]">{children}</div>
);

export const ReportChartEmpty = ({ description }: { description: string }) => (
  <Flex align="center" justify="center" className="h-[260px]">
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
  </Flex>
);

export const ReportLoading = () => (
  <Flex vertical gap={12} aria-busy="true">
    <Row gutter={[12, 12]}>
      {LOADING_CARD_KEYS.map(key => (
        <Col key={key} xs={24} sm={12} xl={6}>
          <Skeleton.Button active block className="!h-[96px]" />
        </Col>
      ))}
    </Row>
    <Skeleton.Button active block className="!h-[300px]" />
  </Flex>
);

export const ReportError = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useTranslation('project-view');

  return (
    <Result
      status="warning"
      title={t('reportsLoadError', { defaultValue: 'Could not load this report' })}
      extra={<Button onClick={onRetry}>{t('retry', { defaultValue: 'Retry' })}</Button>}
    />
  );
};

const getNoteColor = (tone: ReportNoteTone, token: ReturnType<typeof theme.useToken>['token']) => {
  if (tone === 'success') return token.colorSuccess;
  if (tone === 'warning') return token.colorWarning;
  if (tone === 'danger') return token.colorError;
  return token.colorTextSecondary;
};

const LOADING_CARD_KEYS = ['first', 'second', 'third', 'fourth'];
