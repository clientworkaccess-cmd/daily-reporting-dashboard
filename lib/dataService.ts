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

// ─── New Table Names ──────────────────────────────────────────────────────────
// Charlotte: daily_reporting_my_hub   (primary key: report_date)
// Houston:   daily_reporting_storagefms (primary key: report_report_date)
const TABLE_MAP: Record<'charlotte' | 'houston', string> = {
    charlotte: 'daily_reporting_my_hub',
    houston: 'daily_reporting_storagefms',
};

// Each location uses a different column name for its date
const DATE_FIELD: Record<'charlotte' | 'houston', string> = {
    charlotte: 'report_date',
    houston: 'report_report_date',
};

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

// ─── Row-level data-quality checks ───────────────────────────────────────────

const hasKpiRowData = (row: any, location: string): boolean => {
    if (location === 'charlotte') {
        return hasAnyFieldValue(row, [
            'paymenttotals_mtd',
            'units_occupancyrate',
            'activity_moveins_mtd',
            'activity_moveouts_mtd',
            'deposits_achdebit_mtd',
            'paymentinsurance_mtd',
        ]);
    }
    // Houston
    return hasAnyFieldValue(row, [
        'total_revenue_receipts_mtd',
        'occupancy_statistics_occupied_unit_pct',
        'rental_activity_move_ins_mtd',
        'rental_activity_move_outs_mtd',
        'receipts_breakdown_ach_mtd',
        'insurance_protection_pct_insured',
    ]);
};

const hasMetricRowData = (row: any, location: string, metricId: string): boolean => {
    if (location === 'charlotte') {
        switch (metricId) {
            case 'revenue': return hasValue(row.paymenttotals_mtd);
            case 'move_in_out': return hasAnyFieldValue(row, ['activity_moveins_mtd', 'activity_moveouts_mtd']);
            case 'occupancy': return hasValue(row.units_occupancyrate);
            case 'arrears': return hasAnyFieldValue(row, ['paymentinsurance_mtd', 'paymenttotals_mtd']);
            case 'insurance': return hasAnyFieldValue(row, ['paymentother_daily', 'units_occupied']);
            case 'autopay': return hasAnyFieldValue(row, ['units_occupied', 'units_autobilled']);
            case 'leads': return hasAnyFieldValue(row, ['leads_sparefoot_daily', 'leads_phone_daily', 'leads_web_daily', 'leads_walkin_daily']);
            case 'forecast': return hasValue(row.paymenttotals_mtd);
            default: return hasKpiRowData(row, location);
        }
    }
    // Houston
    switch (metricId) {
        case 'revenue': return hasValue(row.total_revenue_receipts_mtd);
        case 'move_in_out': return hasAnyFieldValue(row, ['rental_activity_move_ins_mtd', 'rental_activity_move_outs_mtd']);
        case 'occupancy': return hasValue(row.occupancy_statistics_occupied_unit_pct);
        case 'arrears': return hasAnyFieldValue(row, ['amount_due_totals_total', 'total_revenue_receipts_mtd']);
        case 'insurance': return hasValue(row.insurance_protection_pct_insured);
        case 'autopay': return hasAnyFieldValue(row, ['receipts_breakdown_ach_mtd', 'total_revenue_receipts_mtd']);
        case 'leads': return hasValue(row.leads_summary_total_leads_mtd);
        case 'forecast': return hasValue(row.total_revenue_receipts_mtd);
        default: return hasKpiRowData(row, location);
    }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTableName = (location: string): string =>
    TABLE_MAP[location === 'charlotte' ? 'charlotte' : 'houston'];

const getDateField = (location: string): string =>
    DATE_FIELD[location === 'charlotte' ? 'charlotte' : 'houston'];

// Parse date strings:
//   Charlotte: "Monday, February 9, 2026"
//   Houston:   "Feb 9, 2026" or ISO-like strings
const parseReportDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const cleaned = dateStr.replace(/^[A-Za-z]+,\s*/, '');
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d;
    return new Date();
};

// ─── fetchReportingData ───────────────────────────────────────────────────────

export async function fetchReportingData(location: string, view: string, metric: string) {
    const tableName = getTableName(location);
    const dateField = getDateField(location);

    const { data, error } = await supabase.from(tableName).select('*');

    if (error) {
        console.error('Supabase fetchReportingData error:', error);
        return { labels: [], datasets: [] };
    }
    if (!data || data.length === 0) return { labels: [], datasets: [] };

    // Deduplicate by date then sort ascending
    const uniqueData = Array.from(new Map(data.map(item => [item[dateField], item])).values());
    const sortedData = uniqueData
        .map(row => ({ ...row, dateObj: parseReportDate(row[dateField]) }))
        .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    const metricFilteredData = sortedData.filter(row => hasMetricRowData(row, location, metric));

    const getMetricValue = (row: any, metricId: string): number => {
        if (location === 'charlotte') {
            switch (metricId) {
                case 'revenue':
                    return parseCurrency(row.paymenttotals_mtd);
                case 'move_in_out':
                    return (parseInt(row.activity_moveins_mtd) || 0)
                        - (parseInt(row.activity_moveouts_mtd) || 0);
                case 'occupancy':
                    return row.units_occupancyrate.includes("0.") ? row.units_occupancyrate * 100 : parsePercent(row.units_occupancyrate);
                // case 'arrears': {
                //     const ins = parseCurrency(row.paymentinsurance_mtd);
                //     const total = parseCurrency(row.paymenttotals_mtd);
                //     return total > 0 ? (ins / total) * 100 : 0;
                // }
                case 'arrears': {
                    return parsePercent(row.unpaidcharges_total_percentunits);
                }
                case 'insurance': {
                    const payOther = parseCurrency(row.paymentother_mtd);
                    const unitsOcc = parseFloat(row.units_occupied) || 1;
                    const insurance = ((payOther / 10) / unitsOcc * 100);
                    return insurance;
                }
                case 'autopay': {
                    const ach = parseCurrency(row.units_autobilled);
                    const total = parseCurrency(row.units_occupied);
                    return total > 0 ? (ach / total) * 100 : 0;
                }
                case 'leads':
                    return (parseInt(row.leads_sparefoot_daily) || 0)
                        + (parseInt(row.leads_phone_daily) || 0)
                        + (parseInt(row.leads_web_daily) || 0)
                        + (parseInt(row.leads_walkin_daily) || 0);
                case 'forecast': {
                    const mtd = parseCurrency(row.paymenttotals_mtd);
                    const day = row.dateObj.getDate();
                    const total = new Date(row.dateObj.getFullYear(), row.dateObj.getMonth() + 1, 0).getDate();
                    return day > 0 ? (mtd / day) * total : 0;
                }
                default: return 0;
            }
        } else {
            // Houston
            switch (metricId) {
                case 'revenue':
                    return parseCurrency(row.total_revenue_receipts_mtd);
                case 'move_in_out':
                    return (parseInt(row.rental_activity_move_ins_mtd) || 0)
                        - (parseInt(row.rental_activity_move_outs_mtd) || 0);
                case 'occupancy':
                    return parsePercent(row.occupancy_statistics_occupied_unit_pct);
                case 'arrears': {
                    const due = parseCurrency(row.amount_due_totals_units);
                    const total = parseCurrency(row.occupancy_statistics_occupied_units);
                    return total > 0 ? (due / total) * 100 : 0;
                }
                case 'insurance': {
                    // const amt= "amount_due_totals_units";
                    // const payOther = parseCurrency(row[amt]);
                    // const unitsOcc = parseFloat(row.occupancy_statistics_occupied_units) || 1;
                    // const insurance = (payOther / unitsOcc ) * 100;
                    return parseCurrency(row.insurance_protection_pct_insured);
                }
                case 'autopay': {
                    const ach = parseCurrency(row.receipts_breakdown_ach_mtd);
                    const total = parseCurrency(row.total_revenue_receipts_mtd);
                    return total > 0 ? (ach / total) * 100 : 0;
                }
                case 'leads':
                    return parseInt(row.leads_summary_total_leads_mtd) || 0;
                case 'forecast': {
                    const mtd = parseCurrency(row.total_revenue_receipts_mtd);
                    const day = row.dateObj.getDate();
                    const total = new Date(row.dateObj.getFullYear(), row.dateObj.getMonth() + 1, 0).getDate();
                    return day > 0 ? (mtd / day) * total : 0;
                }
                default: return 0;
            }
        }
    };

    if (view === 'daily') {
        const monthsMap: Record<string, any[]> = {};
        metricFilteredData.forEach(row => {
            const key = row.dateObj.toLocaleString('en-US', { month: 'short', year: '2-digit' });
            if (!monthsMap[key]) monthsMap[key] = [];
            monthsMap[key].push(row);
        });

        const labels = Array.from({ length: 31 }, (_, i) => `${i + 1}`);
        const datasets = Object.keys(monthsMap).map(monthYear => {
            const monthData = new Array(31).fill(null);
            monthsMap[monthYear].forEach(row => {
                monthData[row.dateObj.getDate() - 1] = getMetricValue(row, metric);
            });
            return { label: monthYear, data: monthData };
        });
        datasets.sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime());
        return { labels, datasets };

    } else if (view === 'weekly') {
        const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
        const datasets = [{ label: 'Current', data: [0, 0, 0, 0, 0] }];
        metricFilteredData.forEach(row => {
            const idx = Math.floor((row.dateObj.getDate() - 1) / 7);
            if (idx < 5) datasets[0].data[idx] += Number(getMetricValue(row, metric) || 0);
        });
        return { labels, datasets };

    } else {
        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const yearData = new Array(12).fill(0);
        metricFilteredData.forEach(row => {
            yearData[row.dateObj.getMonth()] += Number(getMetricValue(row, metric) || 0);
        });
        return { labels, datasets: [{ label: String(new Date().getFullYear()), data: yearData }] };
    }
}

// ─── fetchLatestKPIs ──────────────────────────────────────────────────────────

export async function fetchLatestKPIs(location: string, selectedDate?: string) {
    const tableName = getTableName(location);
    const dateField = getDateField(location);

    const { data, error } = await supabase.from(tableName).select('*');

    if (error || !data || data.length === 0) return null;

    // Deduplicate by date field
    const uniqueData = Array.from(new Map(data.map(item => [item[dateField], item])).values());

    // Parse dates, attach _rawDate, sort newest first
    const sorted = uniqueData
        .map(row => ({
            ...row,
            _rawDate: row[dateField] as string,
            dateObj: parseReportDate(row[dateField]),
        }))
        .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

    const meaningfulRows = sorted.filter(row => hasKpiRowData(row, location));
    if (meaningfulRows.length === 0) return null;

    // Build date-selector options
    const availableDates = meaningfulRows.map(r => ({
        raw: r._rawDate,
        day: r.dateObj.getDate().toString(),
        month: r.dateObj.toLocaleString('en-US', { month: 'long' }),
        year: r.dateObj.getFullYear().toString(),
    }));

    // Pick requested date or fall back to latest
    const row = selectedDate
        ? (meaningfulRows.find(r => r._rawDate === selectedDate) ?? meaningfulRows[0])
        : meaningfulRows[0];

    const dateObj = row.dateObj;
    const totalDaysInMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate();
    const currentDay = dateObj.getDate();

    let metrics: Record<string, any>;

    if (location === 'charlotte') {
        const revenueMTD = parseCurrency(row.paymenttotals_mtd);
        const achMTD = parseCurrency(row.units_autobilled);
        const insMTD = parseCurrency(row.units_occupied);
        const moveIns = parseInt(row.activity_moveins_mtd) || 0;
        const moveOuts = parseInt(row.activity_moveouts_mtd) || 0;
        const leadsTotal = (parseInt(row.leads_totals_mtd) || 0)
        // (parseInt(row.leads_phone_daily)     || 0) +
        // (parseInt(row.leads_web_daily)       || 0) +
        // (parseInt(row.leads_walkin_daily)    || 0);

        // last_revenue: derive from previous month entry if available
        const previousMonthRow = meaningfulRows.find(r => {
            const d = r.dateObj;
            const targetMonth = dateObj.getMonth() === 0 ? 11 : dateObj.getMonth() - 1;
            const targetYear = dateObj.getMonth() === 0 ? dateObj.getFullYear() - 1 : dateObj.getFullYear();
            return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
        });
        const lastRevenue = previousMonthRow ? parseCurrency(previousMonthRow.paymenttotals_mtd) : null;

        metrics = {
            revenue: revenueMTD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            last_revenue: lastRevenue,
            move_in_out: `${moveIns} / ${moveOuts}`,
            occupancy: `${row.units_occupancyrate.includes("0.") ? row.units_occupancyrate * 100 : parsePercent(row.units_occupancyrate).toFixed(1)}`,
            // arrears:     revenueMTD > 0 ? ((insMTD / revenueMTD) * 100).toFixed(1) : '0.0',
            arrears: parsePercent(row.unpaidcharges_total_percentunits).toFixed(1),
            insurance: (() => {
                const payOther = parseCurrency(row.paymentother_mtd);
                const unitsOcc = parseFloat(row.units_occupied) || 1;
                return ((payOther / 10) / unitsOcc * 100).toFixed(2);
            })(),
            autopay: revenueMTD > 0 ? ((achMTD / insMTD) * 100).toFixed(1) : '0.0',
            cac: '145.20',
            ltv: '2450.00',
            leads: leadsTotal,
            forecast: currentDay > 0
                ? ((revenueMTD / currentDay) * totalDaysInMonth).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '0.00',
        };

    } else {
        // Houston — daily_reporting_storagefms
        const revenueMTD = parseCurrency(row.total_revenue_receipts_mtd);
        const lastRevenueRaw = readField(row, ['total_revenue_receipts_last_month']);
        const achMTD = parseCurrency(row.receipts_breakdown_ach_mtd);
        const moveIns = parseInt(row.rental_activity_move_ins_mtd) || 0;
        const moveOuts = parseInt(row.rental_activity_move_outs_mtd) || 0;
        const due = parseCurrency(row.amount_due_totals_units);
        const total = parseCurrency(row.occupancy_statistics_occupied_units);
        const arrearsPercent = total > 0 ? (due / total) * 100 : 0;

        metrics = {
            revenue: revenueMTD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            last_revenue: lastRevenueRaw == null ? null : parseCurrency(lastRevenueRaw),
            move_in_out: `${moveIns} / ${moveOuts}`,
            occupancy:parsePercent(row.occupancy_statistics_occupied_unit_pct).toFixed(1),
            arrears: arrearsPercent.toFixed(1),
            insurance: parseCurrency(row.insurance_protection_pct_insured).toFixed(1),
            autopay: revenueMTD > 0 ? ((achMTD / revenueMTD) * 100).toFixed(1) : '0.0',
            cac: '145.20',
            ltv: '2450.00',
            leads: parseInt(row.leads_summary_total_leads_mtd) || 0,
            forecast: currentDay > 0
                ? ((revenueMTD / currentDay) * totalDaysInMonth).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '0.00',
        };
    }

    return { metrics, availableDates, selectedDate: row._rawDate };
}

// ─── fetchForecasts ───────────────────────────────────────────────────────────
// Fetches ALL area_forecasts rows, then matches by year + month in JS.
// This works regardless of how month_year is stored in the DB
// (e.g. "2026-03", "March 2026", "Mar 2026", "03/2026", etc.)
//
// targetYear  = number, e.g. 2026
// targetMonth = number 1-12, e.g. 3 for March

const parseForecastDate = (monthYear: string): { year: number; month: number } | null => {
    if (!monthYear) return null;
    const s = monthYear.trim();

    // "2026-03" or "2026-3"
    const isoMatch = s.match(/^(\d{4})-(\d{1,2})$/);
    if (isoMatch) return { year: parseInt(isoMatch[1]), month: parseInt(isoMatch[2]) };

    // "03/2026" or "3/2026"
    const slashMatch = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (slashMatch) return { year: parseInt(slashMatch[2]), month: parseInt(slashMatch[1]) };

    // "Apr 2026" or "March 2026" — DB stores this format
    const monthYearMatch = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (monthYearMatch) {
        const d = new Date(`${monthYearMatch[1]} 1, ${monthYearMatch[2]}`);
        if (!isNaN(d.getTime())) return { year: d.getFullYear(), month: d.getMonth() + 1 };
    }

    // Last resort generic parse
    const d = new Date(s);
    if (!isNaN(d.getTime())) return { year: d.getFullYear(), month: d.getMonth() + 1 };

    return null;
};

export async function fetchForecasts(targetYear?: number, targetMonth?: number) {
    // Always load all rows — usually a small table (12 rows / year)
    const { data, error } = await supabase
        .from('area_forecasts')
        .select('*')
        .order('updated_at', { ascending: false });

    if (error || !data || data.length === 0) return {};

    let row: any | null = null;

    if (targetYear && targetMonth) {
        // Try to find a row whose month_year matches the requested year+month
        row = data.find(r => {
            const parsed = parseForecastDate(r.month_year);
            return parsed?.year === targetYear && parsed?.month === targetMonth;
        }) ?? null;

        if (row) {
            console.log(`[fetchForecasts] matched "${row.month_year}" for ${targetYear}-${targetMonth}`);
        } else {
            // No forecast data for this specific month → return 0s (don't show another month's data)
            console.warn(`[fetchForecasts] no forecast for ${targetYear}-${targetMonth}, returning 0`);
            return { houston: 0, charlotte: 0, catawba: 0, rock_hill: 0 };
        }
    }

    // No year/month requested → show latest row as default
    if (!row) row = data[0];

    return {
        houston: parseCurrency(row.houston),
        charlotte: parseCurrency(row.charlotte),
        catawba: parseCurrency(row.catawba),
        rock_hill: parseCurrency(row.rock_hill),
    };
}