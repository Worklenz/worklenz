import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip as ChartTooltip } from 'chart.js';
import {
    Button,
    Card,
    Input,
    SearchOutlined,
    Badge,
    Col,
    Empty,
    Flex,
    Row,
    Skeleton,
    Statistic,
    Table,
    Tooltip,
    Tag,
    Typography,
    DownloadOutlined,
    InfoCircleOutlined,
    message,
} from '@/shared/antd-imports';
import { SwapOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

Chart.register(ArcElement, ChartTooltip);
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchFinanceOverview } from '@/features/finance-overview/finance-overview.slice';
import { fetchOrgConfig } from '@/features/org-config/org-config.slice';
import { IFinanceOverviewProject } from '@/api/finance-overview/finance-overview.api.service';
import { financeOverviewApiService } from '@/api/finance-overview/finance-overview.api.service';
import { currencyRatesApiService } from '@/api/settings/currency-rates/currency-rates.api.service';

const { Text } = Typography;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compact display: USD 162.0K */
const fmt = (value: number, currency: string = 'USD'): string =>
    `${currency.toUpperCase()} ${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        notation: 'compact',
    }).format(value)}`;

/** Full display: USD 43,000 */
const fmtFull = (value: number, currency: string = 'USD'): string =>
    `${currency.toUpperCase()} ${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)}`;

const calcUtilization = (cost: number, budget: number): number =>
    budget > 0 ? Math.round((cost / budget) * 100) : 0;

const utilizationColor = (pct: number): string => {
    if (pct > 100) return '#ff4d4f';
    if (pct > 80)  return '#faad14';
    return '#52c41a';
};

// ─── Simple KPI Card ─────────────────────────────────────────────────────────

interface KpiCardProps {
    title: string;
    value: string;
    valueColor: string;
    loading: boolean;
    sign?: string;
    tooltip?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, valueColor, loading, sign, tooltip }) => (
    <Card size="small" loading={loading} style={{ height: '100%' }}>
        <Flex align="center" gap={4} style={{ marginBottom: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{title}</Text>
            {tooltip && (
                <Tooltip title={tooltip}>
                    <InfoCircleOutlined style={{ fontSize: 11, color: '#faad14', cursor: 'pointer' }} />
                </Tooltip>
            )}
        </Flex>
        <div style={{ fontSize: 20, fontWeight: 600, color: valueColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sign ?? ''}{value}
        </div>
    </Card>
);

// ─── Page ────────────────────────────────────────────────────────────────────

const FinanceOverviewPage = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { t } = useTranslation('finance-overview');
    const themeMode = useAppSelector(s => s.themeReducer.mode);

    const { projects, loading } = useAppSelector(s => s.financeOverviewReducer);
    const orgConfig = useAppSelector(s => s.orgConfigReducer);
    const [searchText, setSearchText] = useState('');
    const [exporting, setExporting] = useState(false);

    // ── Base currency & exchange rates ────────────────────────────────────
    const baseCurrency = orgConfig.base_currency || 'USD';
    const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(null);
    const [ratesLoading, setRatesLoading] = useState(false);
    const [ratesFetchedAt, setRatesFetchedAt] = useState<string | null>(null);
    const [ratesError, setRatesError] = useState<string | null>(null);

    // ── Effects ───────────────────────────────────────────────────────────
    useEffect(() => {
        dispatch(fetchFinanceOverview());
        dispatch(fetchOrgConfig());
    }, [dispatch]);

    useEffect(() => {
        setRatesLoading(true);
        setRatesError(null);
        currencyRatesApiService.getRates(baseCurrency)
            .then(res => {
                if (res.done && res.body?.rates) {
                    setExchangeRates(res.body.rates);
                    setRatesFetchedAt(res.body.fetched_at);
                } else {
                    setRatesError(res.message ?? t('currencyNote.fetchUnavailable'));
                }
            })
            .catch((err) => {
                setRatesError(err?.response?.data?.message ?? err?.message ?? t('currencyNote.fetchFailed'));
            })
            .finally(() => setRatesLoading(false));
    }, [baseCurrency]);

    // ── Currency conversion helper ────────────────────────────────────────
    // Rates from the API are: 1 baseCurrency = rates[X] of currency X.
    // To convert amount in X → base: amount / rates[X]
    const convertToBase = (amount: number, fromCurrency: string): number => {
        if (!exchangeRates) return amount;
        const from = fromCurrency.toUpperCase();
        if (from === baseCurrency.toUpperCase()) return amount;
        const rate = exchangeRates[from];
        if (!rate || rate === 0) return amount;
        return amount / rate;
    };

    // ── Converted KPI totals ──────────────────────────────────────────────
    const convertedTotals = useMemo(() => {
        if (!exchangeRates) return null;
        let budget = 0, actual = 0;
        for (const p of projects) {
            const cur = (p.currency || 'USD').toUpperCase();
            budget += convertToBase(p.budget ?? 0, cur);
            actual += convertToBase(p.actual_cost ?? 0, cur);
        }
        return { budget, actual, variance: budget - actual };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exchangeRates, projects]);

    // ── Raw aggregate KPIs (utilization + hours) ─────────────────────────
    const kpis = useMemo(() => {
        // Budget utilization uses converted totals once available, raw otherwise
        const totalBudget = convertedTotals?.budget
            ?? projects.reduce((s, p) => s + (p.budget ?? 0), 0);
        const totalActual = convertedTotals?.actual
            ?? projects.reduce((s, p) => s + (p.actual_cost ?? 0), 0);
        const totalFixed    = projects.reduce((s, p) => s + (p.fixed_cost ?? 0), 0);
        const totalTimeBased = projects.reduce((s, p) => s + (p.time_based_cost ?? 0), 0);
        const totalHours    = projects.reduce((s, p) => s + (p.estimated_hours ?? 0), 0);
        const budgetUtil    = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
        return { totalFixed, totalTimeBased, totalHours, budgetUtil };
    }, [convertedTotals, projects]);

    // ── Projects Needing Attention ────────────────────────────────────────
    const attentionProjects = useMemo(() =>
        projects
            .filter(p => p.budget > 0 && calcUtilization(p.actual_cost, p.budget) > 65)
            .sort((a, b) =>
                calcUtilization(b.actual_cost, b.budget) -
                calcUtilization(a.actual_cost, a.budget)
            ),
        [projects]
    );

    // ── Budget Status Distribution ────────────────────────────────────────
    const distribution = useMemo(() => {
        const total   = projects.length || 1;
        const onTrack = projects.filter(p => calcUtilization(p.actual_cost, p.budget) <= 65).length;
        const watch   = projects.filter(p => { const u = calcUtilization(p.actual_cost, p.budget); return u > 65 && u <= 100; }).length;
        const over    = projects.filter(p => p.actual_cost > p.budget && p.budget > 0).length;
        return { onTrack, watch, over, total };
    }, [projects]);

    const distributionBuckets = useMemo(() => [
        { key: 'onTrack', label: t('distribution.onTrack'), count: distribution.onTrack, color: '#52c41a' },
        { key: 'watch',   label: t('distribution.watch'),   count: distribution.watch,   color: '#faad14' },
        { key: 'over',    label: t('distribution.overBudget'), count: distribution.over, color: '#ff4d4f' },
    ], [distribution, t]);

    const distributionChartData = useMemo(() => ({
        labels: distributionBuckets.map(b => b.label),
        datasets: [{
            data: distributionBuckets.map(b => b.count),
            backgroundColor: distributionBuckets.map(b => b.color),
            spacing: 3, borderRadius: 4, hoverOffset: 4,
        }],
    }), [distributionBuckets]);

    const distributionChartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context: any) => {
                        const value = context.raw as number;
                        const pct = distribution.total > 0 ? Math.round((value / distribution.total) * 100) : 0;
                        return `${context.label}: ${value} (${pct}%)`;
                    },
                },
            },
        },
    }), [distribution.total]);

    const filteredProjects = useMemo(() => {
        if (!searchText.trim()) return projects;
        const lower = searchText.toLowerCase();
        return projects.filter(p =>
            p.name?.toLowerCase().includes(lower) ||
            (p.client_name?.toLowerCase().includes(lower) ?? false)
        );
    }, [projects, searchText]);

    // ── Export ────────────────────────────────────────────────────────────
    const handleExport = async () => {
        try {
            setExporting(true);
            const blob = await financeOverviewApiService.exportPortfolioFinance();
            if (blob.type === 'application/json') {
                message.error(t('exportFailed'));
                return;
            }
            const url  = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href  = url;
            link.download = `finance-overview-${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            message.success(t('exportSuccess'));
        } catch {
            message.error(t('exportFailed'));
        } finally {
            setExporting(false);
        }
    };

    // ── Table columns ─────────────────────────────────────────────────────
    const columns: ColumnsType<IFinanceOverviewProject> = [
        {
            title: t('table.project'),
            dataIndex: 'name',
            key: 'name',
            width: 200,
            render: (name: string, record) => (
                <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: record.color_code || '#1890ff', flexShrink: 0 }} />
                    <Tooltip title={name}>
                        <Text style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170, display: 'block' }}>
                            {name}
                        </Text>
                    </Tooltip>
                </Flex>
            ),
        },
        {
            title: t('table.client'),
            dataIndex: 'client_name',
            key: 'client_name',
            width: 130,
            render: (v: string | null) =>
                v ? (
                    <Tooltip title={v}>
                        <Text style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110, display: 'block' }}>
                            {v}
                        </Text>
                    </Tooltip>
                ) : <Text type="secondary">{t('emptyValue')}</Text>,
        },
        {
            title: t('table.manualBudget'),
            dataIndex: 'budget',
            key: 'budget',
            width: 140,
            render: (v: number, record) =>
                v > 0
                    ? fmtFull(v, record.currency)
                    : <Text type="secondary" style={{ fontSize: 12 }}>{t('noBudgetSet')}</Text>,
        },
        {
            title: t('table.actualCost'),
            dataIndex: 'actual_cost',
            key: 'actual_cost',
            width: 130,
            render: (v: number, record) => (
                <Text strong style={{ color: '#52c41a' }}>{fmtFull(v, record.currency)}</Text>
            ),
        },
        {
            title: t('table.variance'),
            key: 'variance',
            width: 130,
            render: (_: unknown, record) => {
                if (record.budget === 0) return <Text type="secondary" style={{ fontSize: 12 }}>{t('emptyValue')}</Text>;
                const v = record.budget - record.actual_cost;
                return (
                    <Text strong style={{ color: v < 0 ? '#ff4d4f' : v > 0 ? '#52c41a' : 'rgba(0,0,0,0.65)', fontWeight: 'bold' }}>
                        {v < 0 ? '- ' : v > 0 ? '+ ' : ''}{fmtFull(Math.abs(v), record.currency)}
                    </Text>
                );
            },
        },
        {
            title: t('table.budgetUtilization'),
            key: 'utilization',
            width: 160,
            render: (_: unknown, record) => {
                if (record.budget === 0) return <Text type="secondary" style={{ fontSize: 12 }}>{t('noBudgetSet')}</Text>;
                const pct = calcUtilization(record.actual_cost, record.budget);
                return <Text style={{ color: utilizationColor(pct), fontSize: 13, fontWeight: 500 }}>{pct}%</Text>;
            },
        },
        {
            title: t('table.estHours'),
            dataIndex: 'estimated_hours',
            key: 'estimated_hours',
            width: 100,
            render: (v: number) => `${Math.round(v)}h`,
        },
        {
            title: '',
            key: 'action',
            width: 60,
            render: (_: unknown, record) => (
                <Tooltip title={t('viewFinanceButton')}>
                    <Button
                        size="small"
                        onClick={e => { e.stopPropagation(); navigate(`/worklenz/projects/${record.id}?tab=finance`); }}
                        style={{ whiteSpace: 'nowrap' }}
                    >
                        {t('viewButton')}
                    </Button>
                </Tooltip>
            ),
        },
    ];

    // ── Render ────────────────────────────────────────────────────────────
    const kpiLoading = loading || ratesLoading || !convertedTotals;
    const variance   = convertedTotals?.variance ?? 0;
    return (
        <Flex vertical gap={16}>

            {/* Page header */}
            <Flex align="flex-start" justify="space-between">
                <div>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                        {t('pageTitle')}
                    </Typography.Title>
                    <Text type="secondary" style={{ fontSize: 13, marginTop: 2, display: 'block' }}>
                        {t('pageSubTitle')}
                    </Text>
                </div>
                <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    loading={exporting}
                    onClick={handleExport}
                    disabled={loading || !projects.length}
                >
                    {t('exportButton')}
                </Button>
            </Flex>

            {/* ── KPI Cards ── */}
            <Row gutter={[12, 12]}>
                {/* Total Manual Budget */}
                <Col xs={24} sm={12} lg={5}>
                    <KpiCard
                        title={t('kpiCard.totalManualBudget')}
                        value={convertedTotals ? fmt(convertedTotals.budget, baseCurrency) : '—'}
                        valueColor="#1890ff"
                        loading={kpiLoading}
                    />
                </Col>

                {/* Total Actual Cost */}
                <Col xs={24} sm={12} lg={5}>
                    <KpiCard
                        title={t('kpiCard.totalActualCost')}
                        value={convertedTotals ? fmt(convertedTotals.actual, baseCurrency) : '—'}
                        valueColor="#52c41a"
                        loading={kpiLoading}
                    />
                </Col>

                {/* Total Variance */}
                <Col xs={24} sm={12} lg={5}>
                    <KpiCard
                        title={t('kpiCard.totalVariance')}
                        value={convertedTotals ? fmt(Math.abs(variance), baseCurrency) : '—'}
                        sign={variance < 0 ? '- ' : variance > 0 ? '+ ' : ''}
                        valueColor={variance < 0 ? '#ff4d4f' : variance > 0 ? '#52c41a' : 'rgba(0,0,0,0.65)'}
                        loading={kpiLoading}
                    />
                </Col>

                {/* Budget Utilization */}
                <Col xs={24} sm={12} lg={4}>
                    <Card size="small" loading={loading} style={{ height: '100%' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{t('kpiCard.budgetUtilization')}</Text>
                        <Statistic
                            value={kpis.budgetUtil}
                            precision={0}
                            suffix="%"
                            valueStyle={{
                                color: kpis.budgetUtil > 100 ? '#ff4d4f' : kpis.budgetUtil > 80 ? '#faad14' : '#52c41a',
                                fontSize: 20,
                                fontWeight: 600,
                            }}
                        />
                    </Card>
                </Col>

                {/* Estimated Hours */}
                <Col xs={24} sm={12} lg={5}>
                    <Card size="small" loading={loading} style={{ height: '100%' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{t('kpiCard.estimatedHours')}</Text>
                        <Statistic
                            value={Math.round(kpis.totalHours)}
                            suffix="h"
                            valueStyle={{ color: '#722ed1', fontSize: 20, fontWeight: 600 }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Currency conversion note */}
            {ratesError ? (
                <Text type="danger" style={{ fontSize: 12 }}>
                    <InfoCircleOutlined style={{ marginRight: 4 }} />
                    {t('currencyNote.unavailable')}{' '}
                    {ratesError}{' '}
                    <a href="/worklenz/settings/organization-currency" style={{ fontSize: 11 }}>
                        {t('currencyNote.checkSettings')}
                    </a>
                </Text>
            ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                    <SwapOutlined style={{ marginRight: 4, color: '#1890ff' }} />
                    {t('currencyNote.convertedPrefix')}{' '}
                    <strong>{baseCurrency}</strong>
                    {' '}{t('currencyNote.convertedSuffix', {
                        time: ratesFetchedAt ? new Date(ratesFetchedAt).toLocaleTimeString() : '',
                    })}
                    {' '}
                    <a href="/worklenz/settings/organization-currency" style={{ fontSize: 11 }}>
                        {t('currencyNote.changeCurrency')}
                    </a>
                </Text>
            )}

            {/* ── Second row: table + sidebar ── */}
            <Row gutter={[16, 16]}>

                {/* Project Financial Health Table */}
                <Col xs={24} lg={19}>
                    <Card
                        title={<Text strong style={{ fontSize: 15 }}>{t('tableCard.title')}</Text>}
                        styles={{ header: { padding: '12px 24px', minHeight: 56 } }}
                        extra={
                            <Input
                                placeholder={t('table.searchPlaceholder')}
                                suffix={<SearchOutlined style={{ color: 'rgba(128,128,128,0.7)' }} />}
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                allowClear
                                style={{
                                    width: 280,
                                    borderColor: themeMode === 'dark' ? '#424242' : '#bfbfbf',
                                    backgroundColor: themeMode === 'dark' ? '#1f1f1f' : '#ffffff',
                                }}
                            />
                        }
                        style={{ height: '100%' }}
                    >
                        <Table<IFinanceOverviewProject>
                            rowKey="id"
                            dataSource={filteredProjects}
                            columns={columns}
                            loading={loading}
                            size="small"
                            onRow={record => ({
                                onClick: () => navigate(`/worklenz/projects/${record.id}?tab=finance`),
                                style: { cursor: 'pointer' },
                            })}
                            pagination={{
                                defaultPageSize: 10,
                                pageSizeOptions: ['5', '10', '20', '50'],
                                showSizeChanger: true,
                                showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}`,
                            }}
                            scroll={{ x: 900 }}
                        />
                    </Card>
                </Col>

                {/* Projects Needing Attention + Budget Status Distribution */}
                <Col xs={24} lg={5}>
                    <Flex vertical gap={16}>

                        {/* Projects Needing Attention */}
                        <Card title={t('attention.title')} size="small">
                            {loading ? (
                                <Skeleton active />
                            ) : attentionProjects.length === 0 ? (
                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('attention.emptyState')} />
                            ) : (
                                <div style={{ maxHeight: 240, overflowY: 'auto', paddingRight: 8, scrollbarWidth: 'thin', scrollbarColor: '#ccc transparent' }}>
                                    <Flex vertical gap={12}>
                                        {attentionProjects.map(p => {
                                            const pct    = calcUtilization(p.actual_cost, p.budget);
                                            const isOver = p.actual_cost > p.budget;
                                            return (
                                                <Flex key={p.id} vertical gap={4}>
                                                    <Flex align="center" gap={6}>
                                                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: p.color_code || '#1890ff', flexShrink: 0 }} />
                                                        <Text style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</Text>
                                                    </Flex>
                                                    <Flex align="center" justify="space-between" gap={8}>
                                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                                            {`${pct}% ${t('attention.ofBudgetSpent')}`}
                                                        </Text>
                                                        <span style={{
                                                            display: 'inline-block', padding: '2px 10px', borderRadius: 6,
                                                            fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                                                            backgroundColor: isOver ? 'rgba(255, 77, 79, 0.15)' : 'rgba(250, 173, 20, 0.15)',
                                                            color: isOver ? '#ff4d4f' : '#faad14',
                                                            border: `1px solid ${isOver ? 'rgba(255, 77, 79, 0.4)' : 'rgba(250, 173, 20, 0.4)'}`,
                                                        }}>
                                                            {isOver ? t('attention.overBudget') : t('attention.watch')}
                                                        </span>
                                                    </Flex>
                                                </Flex>
                                            );
                                        })}
                                    </Flex>
                                </div>
                            )}
                        </Card>

                        {/* Budget Status Distribution */}
                        <Card title={t('distribution.title')} size="small">
                            {loading ? (
                                <Skeleton active />
                            ) : projects.length === 0 ? (
                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('attention.emptyState')} />
                            ) : (
                                <Flex vertical gap={16} align="center">
                                    <div style={{ position: 'relative', width: 148, height: 148 }}>
                                        <Doughnut data={distributionChartData} options={distributionChartOptions} />
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                            <Text strong style={{ fontSize: 22, lineHeight: 1 }}>{projects.length}</Text>
                                            <Text type="secondary" style={{ fontSize: 11 }}>{t('distribution.total')}</Text>
                                        </div>
                                    </div>

                                    <Flex vertical gap={8} style={{ width: '100%' }}>
                                        {distributionBuckets.map(bucket => (
                                            <Flex key={bucket.key} justify="space-between" align="center">
                                                <Flex align="center" gap={6}>
                                                    <Badge color={bucket.color} />
                                                    <Text style={{ fontSize: 13 }}>{bucket.label}</Text>
                                                </Flex>
                                                <Text type="secondary" style={{ fontSize: 13 }}>
                                                    {bucket.count} {t('distribution.projects')}
                                                </Text>
                                            </Flex>
                                        ))}
                                    </Flex>

                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {t('distribution.breakdown', {
                                            fixed: fmt(kpis.totalFixed, baseCurrency),
                                            timeBased: fmt(kpis.totalTimeBased, baseCurrency),
                                        })}
                                    </Text>
                                </Flex>
                            )}
                        </Card>

                    </Flex>
                </Col>
            </Row>

        </Flex>
    );
};

export default FinanceOverviewPage;
