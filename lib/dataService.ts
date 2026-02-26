import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Parse currency strings like "$26,248.69" or "26248.69" or "0"
const parseCurrency = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val || val === '' || val === '0') return 0;
    return parseFloat(val.toString().replace(/[$,]/g, '')) || 0;
};

// Parse percent strings like "69.00%" or "69" or "2.9"
const parsePercent = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val || val === '') return 0;
    return parseFloat(val.toString().replace(/[%]/g, '')) || 0;
};

const TABLE_CANDIDATES: Record<'charlotte' | 'houston', string[]> = {
    charlotte: ['daily-reporting', 'daily_reporting', 'daily - reporting'],
    houston: ['daily-reporting-houston', 'daily_reporting_houston', 'daily - reporting - houston'],
};

const TABLE_PROBE_COLUMNS: Record<'charlotte' | 'houston', string> = {
    charlotte: 'report_date,paymentTotals_mtd,units_occupancyRate',
    houston: 'report_date,revenue_total_mtd,total_rev_last_month',
};

const tableNameCache: Partial<Record<'charlotte' | 'houston', string>> = {};

const readField = (row: any, keys: string[]) => {
    for (const key of keys) {
        const value = row?.[key];
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }
    return null;
};

const hasValue = (value: any): boolean => {
    if (value === undefined || value === null) return false;
    const text = String(value).trim().toLowerCase();
    return text !== '' && text !== 'null' && text !== 'undefined' && text !== 'n/a';
};

const hasAnyFieldValue = (row: any, keys: string[]): boolean =>
    keys.some((key) => hasValue(row?.[key]));

const hasKpiRowData = (row: any, location: string): boolean => {
    if (location === 'charlotte') {
        return hasAnyFieldValue(row, [
            'paymentTotals_mtd',
            'units_occupancyRate',
            'activity_moveIns_mtd',
            'activity_moveins_mtd',
            'activity_moveOuts_mtd',
            'activity_moveouts_mtd',
            'deposits_achDebit_mtd',
            'paymentInsurance_mtd',
        ]);
    }

    return hasAnyFieldValue(row, [
        'revenue_total_mtd',
        'occupancy_occupied_pct',
        'activity_moveins_mtd',
        'activity_moveouts_mtd',
        'receipts_ach_mtd',
        'protection_pct_insured',
    ]);
};

const hasMetricRowData = (row: any, location: string, metricId: string): boolean => {
    if (location === 'charlotte') {
        switch (metricId) {
            case 'revenue':
                return hasValue(row.paymentTotals_mtd);
            case 'move_in_out':
                return hasAnyFieldValue(row, ['activity_moveIns_mtd', 'activity_moveins_mtd', 'activity_moveOuts_mtd', 'activity_moveouts_mtd']);
            case 'occupancy':
                return hasValue(row.units_occupancyRate);
            case 'arrears':
                return hasAnyFieldValue(row, ['paymentInsurance_mtd', 'paymentTotals_mtd']);
            case 'insurance':
                return hasAnyFieldValue(row, ['paymentOther_daily', 'units_occupied']);
            case 'autopay':
                return hasAnyFieldValue(row, ['deposits_achDebit_mtd', 'paymentTotals_mtd']);
            case 'leads':
                return hasAnyFieldValue(row, ['leads_spareFoot_daily', 'leads_phone_daily', 'leads_web_daily', 'leads_walkIn_daily']);
            case 'forecast':
                return hasValue(row.paymentTotals_mtd);
            default:
                return hasKpiRowData(row, location);
        }
    }

    switch (metricId) {
        case 'revenue':
            return hasValue(row.revenue_total_mtd);
        case 'move_in_out':
            return hasAnyFieldValue(row, ['activity_moveins_mtd', 'activity_moveouts_mtd', 'activity_moveIns_mtd', 'activity_moveOuts_mtd']);
        case 'occupancy':
            return hasValue(row.occupancy_occupied_pct);
        case 'arrears':
            return hasAnyFieldValue(row, ['daily_arrears_pct', 'arrears_pct', 'due_totals_amount', 'revenue_total_mtd']);
        case 'insurance':
            return hasValue(row.protection_pct_insured);
        case 'autopay':
            return hasAnyFieldValue(row, ['receipts_ach_mtd', 'revenue_total_mtd']);
        case 'leads':
            return hasValue(row.leads_move_ins_mtd);
        case 'forecast':
            return hasValue(row.revenue_total_mtd);
        default:
            return hasKpiRowData(row, location);
    }
};

const resolveTableName = async (location: string): Promise<string> => {
    const locationKey = location === 'charlotte' ? 'charlotte' : 'houston';

    if (tableNameCache[locationKey]) {
        return tableNameCache[locationKey]!;
    }

    const candidates = TABLE_CANDIDATES[locationKey];
    const probeColumns = TABLE_PROBE_COLUMNS[locationKey];

    let firstQueryable: string | null = null;
    let firstWithData: string | null = null;

    for (const candidate of candidates) {
        const { data, error } = await supabase
            .from(candidate)
            .select(probeColumns)
            .limit(1);

        if (error) {
            continue;
        }

        if (!firstQueryable) {
            firstQueryable = candidate;
        }

        if (Array.isArray(data) && data.length > 0) {
            firstWithData = candidate;
            break;
        }
    }

    const resolved = firstWithData ?? firstQueryable ?? candidates[0];
    tableNameCache[locationKey] = resolved;
    return resolved;
};

// Parse date strings - handles both:
// Charlotte: "Monday, February 9, 2026"
// Houston:   "Feb 9, 2026"
const parseReportDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    // Remove day-of-week prefix if present (e.g. "Monday, ")
    const cleaned = dateStr.replace(/^[A-Za-z]+,\s*/, '');
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d;
    return new Date();
};

export async function fetchReportingData(location: string, view: string, metric: string) {
    const tableName = await resolveTableName(location);

    const { data, error } = await supabase
        .from(tableName)
        .select('*');

    if (error) {
        console.error('Supabase error:', error);
        return { labels: [], datasets: [] };
    }

    if (!data || data.length === 0) {
        return { labels: [], datasets: [] };
    }

    // Deduplicate and Sort data by date
    const uniqueData = Array.from(new Map(data.map(item => [item.report_date, item])).values());

    const sortedData = uniqueData.map(row => {
        const dateObj = parseReportDate(row.report_date);
        return { ...row, dateObj };
    }).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    const metricFilteredData = sortedData.filter((row) => hasMetricRowData(row, location, metric));

    // Map metrics to columns based on exact table structure
    const getMetricValue = (row: any, metricId: string) => {
        if (location === 'charlotte') {
            switch (metricId) {
                case 'revenue':
                    return parseCurrency(row.paymentTotals_mtd);
                case 'move_in_out':
                    return (parseInt(readField(row, ['activity_moveIns_mtd', 'activity_moveins_mtd'])) || 0) -
                        (parseInt(readField(row, ['activity_moveOuts_mtd', 'activity_moveouts_mtd'])) || 0);
                case 'occupancy':
                    return parsePercent(row.units_occupancyRate);
                case 'arrears': {
                    // Arrears % = paymentInsurance_mtd / paymentTotals_mtd * 100
                    const ins = parseCurrency(row.paymentInsurance_mtd);
                    const total = parseCurrency(row.paymentTotals_mtd);
                    return total > 0 ? (ins / total) * 100 : 0;
                }
                case 'insurance': {
                    // Insurance = (paymentOther_daily / 12) / units_occupied
                    const payOther = parseCurrency(row.paymentOther_daily);
                    const unitsOcc = parseFloat(row.units_occupied) || 1;
                    return (payOther / 12) / unitsOcc * 100;
                }
                case 'autopay': {
                    // Autopay % = ACH Debit MTD / Total Payments MTD * 100
                    const ach = parseCurrency(row.deposits_achDebit_mtd);
                    const total = parseCurrency(row.paymentTotals_mtd);
                    return total > 0 ? (ach / total) * 100 : 0;
                }
                case 'leads':
                    return (parseInt(row.leads_spareFoot_daily) || 0) +
                        (parseInt(row.leads_phone_daily) || 0) +
                        (parseInt(row.leads_web_daily) || 0) +
                        (parseInt(row.leads_walkIn_daily) || 0);
                case 'forecast': {
                    const mtdRevenue = parseCurrency(row.paymentTotals_mtd);
                    const day = row.dateObj.getDate();
                    const totalDays = new Date(row.dateObj.getFullYear(), row.dateObj.getMonth() + 1, 0).getDate();
                    return day > 0 ? (mtdRevenue / day) * totalDays : 0;
                }
                default: return 0;
            }
        } else {
            // Houston - new table structure
            switch (metricId) {
                case 'revenue': return parseCurrency(row.revenue_total_mtd);
                case 'move_in_out':
                    return (parseInt(readField(row, ['activity_moveins_mtd', 'activity_moveIns_mtd'])) || 0) -
                        (parseInt(readField(row, ['activity_moveouts_mtd', 'activity_moveOuts_mtd'])) || 0);
                case 'occupancy': return parsePercent(row.occupancy_occupied_pct);
                case 'arrears': {
                    const explicitArrears = parsePercent(readField(row, ['daily_arrears_pct', 'arrears_pct']));
                    if (explicitArrears > 0) return explicitArrears;
                    const dueAmount = parseCurrency(readField(row, ['due_totals_amount']));
                    const totalRevenue = parseCurrency(row.revenue_total_mtd);
                    return totalRevenue > 0 ? (dueAmount / totalRevenue) * 100 : 0;
                }
                case 'insurance': {
                    // Insurance = due_totals_units / occupancy_occupied_units
                    return parsePercent(row.protection_pct_insured);
                    // const occupancyUnits = parseFloat(row.occupancy_occupied_units) || 1;
                    // return (dueTotalsUnits / occupancyUnits) * 100;
                }
                case 'autopay': {
                    const ach = parseCurrency(row.receipts_ach_mtd);
                    const total = parseCurrency(row.revenue_total_mtd);
                    return total > 0 ? (ach / total) * 100 : 0;
                }
                case 'leads': return parseInt(row.leads_move_ins_mtd) || 0;
                case 'forecast': {
                    const mtdRevenue = parseCurrency(row.revenue_total_mtd);
                    const day = row.dateObj.getDate();
                    const totalDays = new Date(row.dateObj.getFullYear(), row.dateObj.getMonth() + 1, 0).getDate();
                    return day > 0 ? (mtdRevenue / day) * totalDays : 0;
                }
                default: return 0;
            }
        }
    };

    if (view === 'daily') {
        // Group by Month-Year for multi-month overlay chart
        const monthsMap: Record<string, any[]> = {};
        metricFilteredData.forEach(row => {
            const monthYear = row.dateObj.toLocaleString('en-US', { month: 'short', year: '2-digit' });
            if (!monthsMap[monthYear]) monthsMap[monthYear] = [];
            monthsMap[monthYear].push(row);
        });

        const labels = Array.from({ length: 31 }, (_, i) => `${i + 1}`);
        const datasets = Object.keys(monthsMap).map((monthYear) => {
            const monthData = new Array(31).fill(null);
            monthsMap[monthYear].forEach(row => {
                monthData[row.dateObj.getDate() - 1] = getMetricValue(row, metric);
            });
            return { label: monthYear, data: monthData };
        });

        datasets.sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime());
        return { labels, datasets };

    } else if (view === 'weekly') {
        const labels = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"];
        const datasets = [{ label: "Current", data: [0, 0, 0, 0, 0] }];

        metricFilteredData.forEach(row => {
            const weekIdx = Math.floor((row.dateObj.getDate() - 1) / 7);
            if (weekIdx < 5) {
                datasets[0].data[weekIdx] += Number(getMetricValue(row, metric) || 0);
            }
        });

        return { labels, datasets };

    } else {
        // Monthly
        const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const yearData = new Array(12).fill(0);

        metricFilteredData.forEach(row => {
            yearData[row.dateObj.getMonth()] += Number(getMetricValue(row, metric) || 0);
        });

        return { labels, datasets: [{ label: "2026", data: yearData }] };
    }
}

export function calculateForecast(currentRevenue: number, currentDay: number, totalDays: number) {
    if (currentDay === 0) return 0;
    return (currentRevenue / currentDay) * totalDays;
}

export async function fetchLatestKPIs(location: string, selectedDate?: string) {
    const tableName = await resolveTableName(location);

    const { data, error } = await supabase
        .from(tableName)
        .select('*');

    if (error || !data || data.length === 0) {
        return null;
    }

    // Deduplicate by report_date
    const uniqueData = Array.from(new Map(data.map(item => [item.report_date, item])).values());

    // Parse dates and sort newest first
    const sorted = uniqueData.map(row => ({
        ...row,
        dateObj: parseReportDate(row.report_date)
    })).sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

    const meaningfulRows = sorted.filter((row) => hasKpiRowData(row, location));

    if (meaningfulRows.length === 0) {
        return null;
    }

    // Build available dates list for the selectors
    const availableDates = meaningfulRows.map(r => ({
        raw: r.report_date,
        day: r.dateObj.getDate().toString(),
        month: r.dateObj.toLocaleString('en-US', { month: 'long' }),
        year: r.dateObj.getFullYear().toString()
    }));

    // Pick the selected row (or latest)
    const row = selectedDate
        ? meaningfulRows.find(r => r.report_date === selectedDate) || meaningfulRows[0]
        : meaningfulRows[0];

    const dateObj = row.dateObj;
    const totalDaysInMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate();
    const currentDay = dateObj.getDate();

    let metrics: Record<string, any>;

    if (location === 'charlotte') {
        const revenueMTD = parseCurrency(row.paymentTotals_mtd);
        const achMTD = parseCurrency(row.deposits_achDebit_mtd);
        const insMTD = parseCurrency(row.paymentInsurance_mtd);
        const lastRevenueRaw = readField(row, ['total_rev_last_month', 'paymentTotals_last_month']);
        const moveIns = parseInt(readField(row, ['activity_moveIns_mtd', 'activity_moveins_mtd'])) || 0;
        const moveOuts = parseInt(readField(row, ['activity_moveOuts_mtd', 'activity_moveouts_mtd'])) || 0;
        const leadsTotal = (parseInt(row.leads_spareFoot_daily) || 0) +
            (parseInt(row.leads_phone_daily) || 0) +
            (parseInt(row.leads_web_daily) || 0) +
            (parseInt(row.leads_walkIn_daily) || 0);

        metrics = {
            revenue: revenueMTD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            last_revenue: lastRevenueRaw == null ? null : parseCurrency(lastRevenueRaw),
            move_in_out: `${moveIns} / ${moveOuts}`,
            occupancy: parsePercent(row.units_occupancyRate).toFixed(1),
            arrears: revenueMTD > 0 ? ((insMTD / revenueMTD) * 100).toFixed(1) : '0.0',
            insurance: (() => {
                // Insurance = (paymentOther_daily / 12) / units_occupied
                const payOther = parseCurrency(row.paymentOther_daily);
                const unitsOcc = parseFloat(row.units_occupied) || 1;

                return ((payOther / 12) / unitsOcc * 100).toFixed(2);
            })(),
            autopay: revenueMTD > 0 ? ((achMTD / revenueMTD) * 100).toFixed(1) : '0.0',
            cac: '145.20',
            ltv: '2450.00',
            leads: leadsTotal,
            forecast: currentDay > 0
                ? ((revenueMTD / currentDay) * totalDaysInMonth).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '0.00',
        };
    } else {
        // Houston - new table structure
        const revenueMTD = parseCurrency(row.revenue_total_mtd);
        const lastRevenueRaw = readField(row, ['total_rev_last_month']);
        const achMTD = parseCurrency(row.receipts_ach_mtd);
        const moveIns = parseInt(readField(row, ['activity_moveins_mtd', 'activity_moveIns_mtd'])) || 0;
        const moveOuts = parseInt(readField(row, ['activity_moveouts_mtd', 'activity_moveOuts_mtd'])) || 0;
        const explicitArrears = parsePercent(readField(row, ['daily_arrears_pct', 'arrears_pct']));
        const dueAmount = parseCurrency(readField(row, ['due_totals_amount']));
        const arrearsPercent = explicitArrears > 0
            ? explicitArrears
            : (revenueMTD > 0 ? (dueAmount / revenueMTD) * 100 : 0);

        metrics = {
            revenue: revenueMTD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            last_revenue: lastRevenueRaw == null ? null : parseCurrency(lastRevenueRaw),
            move_in_out: `${moveIns} / ${moveOuts}`,
            occupancy: parsePercent(row.occupancy_occupied_pct).toFixed(1),
            arrears: arrearsPercent.toFixed(1),
            insurance: (() => {
                return parsePercent(row.protection_pct_insured).toFixed(2);
            })(),
            autopay: revenueMTD > 0 ? ((achMTD / revenueMTD) * 100).toFixed(1) : '0.0',
            cac: '145.20',
            ltv: '2450.00',
            leads: parseInt(row.leads_move_ins_mtd) || 0,
            forecast: currentDay > 0
                ? ((revenueMTD / currentDay) * totalDaysInMonth).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '0.00',
        };
    }

    return { metrics, availableDates, selectedDate: row.report_date };
}
