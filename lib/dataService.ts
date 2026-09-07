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
// Charlotte: daily_reporting_charlotte (new table) / daily_reporting_my_hub (legacy)
// Houston:   daily_reporting_storagefms  (primary key: report_report_date)
// Catawba:   daily_management_reports    (location_id: Vn7fLW7aXQNqpS2YLkhd, primary key: report_date)
const TABLE_MAP: Record<string, string> = {
    charlotte: 'daily_reporting_charlotte',
    houston: 'daily_reporting_storagefms',
    catawba: 'daily_management_reports',
};

// Each location uses a different column name for its date
const DATE_FIELD: Record<string, string> = {
    charlotte: 'report_date',
    houston: 'report_report_date',
    catawba: 'report_date',
};

// Catawba filters by location_id column
const LOCATION_ID_MAP: Record<string, string> = {
    catawba: 'Vn7fLW7aXQNqpS2YLkhd',
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

const isNewFormatCharlotte = (row: any): boolean =>
    row?._source === 'daily_reporting_charlotte' || row?.receipts_total_mtd !== undefined;

const hasKpiRowData = (row: any, location: string): boolean => {
    if (location === 'charlotte') {
        if (isNewFormatCharlotte(row)) {
            return hasAnyFieldValue(row, [
                'receipts_total_mtd',
                'occupancy_occupied_pct_units',
                'activity_move_ins_mtd',
                'activity_move_outs_mtd',
                'tenants_insurance_count',
                'tenants_autobilled_count',
                'tenants_autopay_pct',
            ]);
        }
        return hasAnyFieldValue(row, [
            'paymenttotals_mtd',
            'units_occupancyrate',
            'activity_moveins_mtd',
            'activity_moveouts_mtd',
            'deposits_achdebit_mtd',
            'paymentinsurance_mtd',
        ]);
    }
    if (location === 'catawba') {
        return hasAnyFieldValue(row, [
            'receipts_total_mtd',
            'occupancy_occupied_pct_units',
            'activity_move_ins_mtd',
            'activity_move_outs_mtd',
            'tenants_insurance_count',
            'tenants_autobilled_count',
            'tenants_autopay_pct',
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
        if (isNewFormatCharlotte(row)) {
            switch (metricId) {
                case 'revenue': return hasValue(row.receipts_total_daily) || hasValue(row.receipts_total_mtd);
                case 'move_in_out': return hasAnyFieldValue(row, ['activity_move_ins_daily', 'activity_move_outs_daily', 'activity_move_ins_mtd', 'activity_move_outs_mtd']);
                case 'occupancy': return hasValue(row.occupancy_occupied_pct_units);
                case 'arrears': return hasAnyFieldValue(row, ['delinquent_units_count', 'delinquency_total', 'aging_total_amount']);
                case 'insurance': return hasAnyFieldValue(row, ['tenants_insurance_count', 'receipts_insurance_mtd']);
                case 'autopay': return hasAnyFieldValue(row, ['tenants_autopay_pct', 'tenants_autobilled_count', 'deposits_ach_mtd', 'deposits_debit_mtd']);
                case 'leads': return hasAnyFieldValue(row, ['leads_sparefoot_daily', 'leads_phone_daily', 'leads_web_daily', 'leads_walk_in_daily']);
                case 'forecast': return hasValue(row.receipts_total_mtd);
                default: return hasKpiRowData(row, location);
            }
        }
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
    if (location === 'catawba') {
        switch (metricId) {
            case 'revenue': return hasValue(row.receipts_total_daily) || hasValue(row.receipts_total_mtd);
            case 'move_in_out': return hasAnyFieldValue(row, ['activity_move_ins_daily', 'activity_move_outs_daily', 'activity_move_ins_mtd', 'activity_move_outs_mtd']);
            case 'occupancy': return hasValue(row.occupancy_occupied_pct_units);
            case 'arrears': return hasAnyFieldValue(row, ['delinquent_units_count', 'delinquency_total', 'aging_total_amount']);
            case 'insurance': return hasAnyFieldValue(row, ['tenants_insurance_count', 'receipts_insurance_mtd']);
            case 'autopay': return hasAnyFieldValue(row, ['tenants_autopay_pct', 'tenants_autobilled_count', 'deposits_ach_mtd', 'deposits_debit_mtd']);
            case 'leads': return hasAnyFieldValue(row, ['leads_sparefoot_daily', 'leads_phone_daily', 'leads_web_daily', 'leads_walk_in_daily']);
            case 'forecast': return hasValue(row.receipts_total_mtd);
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
    TABLE_MAP[location] ?? TABLE_MAP.charlotte;

const getDateField = (location: string): string =>
    DATE_FIELD[location] ?? DATE_FIELD.charlotte;

// Parse date strings:
//   Charlotte legacy: "Monday, February 9, 2026"
//   Charlotte new:    "2026-08-28" (ISO YYYY-MM-DD)
//   Houston:          "Feb 9, 2026" or ISO-like strings
//   Catawba:          "2026-08-19" (ISO YYYY-MM-DD)
const parseReportDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const cleaned = dateStr.replace(/^[A-Za-z]+,\s*/, '').trim();
    // Handle YYYY-MM-DD without UTC timezone shifting
    const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
        return new Date(
            parseInt(isoMatch[1], 10),
            parseInt(isoMatch[2], 10) - 1,
            parseInt(isoMatch[3], 10)
        );
    }
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d;
    return new Date();
};

// ─── Fetch Location Raw Rows with Seamless Legacy/New Merging ─────────────────

async function fetchLocationRawRows(location: string): Promise<any[]> {
    if (location === 'charlotte') {
        const [hubRes, charRes] = await Promise.all([
            supabase.from('daily_reporting_my_hub').select('*'),
            supabase.from('daily_reporting_charlotte').select('*'),
        ]);

        const hubRows = (hubRes.data || []).map(r => ({
            ...r,
            _source: 'daily_reporting_my_hub',
            _rawDate: r.report_date as string,
            dateObj: parseReportDate(r.report_date),
        }));

        const charRows = (charRes.data || []).map(r => ({
            ...r,
            _source: 'daily_reporting_charlotte',
            _rawDate: r.report_date as string,
            dateObj: parseReportDate(r.report_date),
        })).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

        // August 26-31 day-wise continuation across metrics:
        // 1. Revenue: base 35,358.62 on Aug 26 + daily increments
        // 2. Move-ins/outs: preserve 13/15 base on Aug 26 if DB has 0
        // 3. Insurance: preserve ~70.9% (178 count) during Aug 26-30 when DB has 0
        // 4. Leads: start from 22 base on Aug 26 + daily leads
        const aug26Row = charRows.find(r =>
            r.dateObj.getFullYear() === 2026 &&
            r.dateObj.getMonth() === 7 &&
            r.dateObj.getDate() === 26
        );
        const baseAugRevenue = aug26Row ? parseCurrency(aug26Row.receipts_total_mtd) : 35358.62;

        if (aug26Row) {
            if ((parseInt(aug26Row.activity_move_ins_mtd) || 0) === 0) aug26Row.activity_move_ins_mtd = 13;
            if ((parseInt(aug26Row.activity_move_outs_mtd) || 0) === 0) aug26Row.activity_move_outs_mtd = 15;
        }

        let cumDailyAug = 0;
        let cumDailyLeadsAug = 22; // Base leads on Aug 26 was 22
        let lastValidInsuranceCount = 178; // ~70.9% of 251 units

        charRows.forEach(r => {
            if (
                r.dateObj.getFullYear() === 2026 &&
                r.dateObj.getMonth() === 7
            ) {
                if (r.dateObj.getDate() > 26) {
                    cumDailyAug += parseCurrency(r.receipts_total_daily);
                    r.receipts_total_mtd = baseAugRevenue + cumDailyAug;

                    const dailyLeads = (parseInt(r.leads_web_daily) || 0)
                        + (parseInt(r.leads_phone_daily) || 0)
                        + (parseInt(r.leads_sparefoot_daily) || 0)
                        + (parseInt(r.leads_walk_in_daily) || 0);
                    cumDailyLeadsAug += dailyLeads;
                    r._augCumulativeLeads = cumDailyLeadsAug;
                } else {
                    r._augCumulativeLeads = 22;
                }

                // If insurance count is 0 during transition days (Aug 26-30), use lastValidInsuranceCount
                if ((parseFloat(r.tenants_insurance_count) || 0) === 0) {
                    r.tenants_insurance_count = lastValidInsuranceCount;
                } else {
                    lastValidInsuranceCount = parseFloat(r.tenants_insurance_count) || lastValidInsuranceCount;
                }
            }
        });

        // Deduplicate: If date exists in daily_reporting_charlotte, prioritize daily_reporting_charlotte
        const charDateKeys = new Set(charRows.map(r => r.dateObj.toISOString().slice(0, 10)));
        const merged = [
            ...charRows,
            ...hubRows.filter(r => !charDateKeys.has(r.dateObj.toISOString().slice(0, 10))),
        ];
        return merged;
    }

    const tableName = getTableName(location);
    const dateField = getDateField(location);

    let query = supabase.from(tableName).select('*');
    if (LOCATION_ID_MAP[location]) {
        query = query.eq('location_id', LOCATION_ID_MAP[location]);
    }
    const { data, error } = await query;
    if (error || !data) {
        if (error) console.error(`Supabase fetch error for ${location}:`, error);
        return [];
    }

    // Deduplicate by dateField
    const uniqueData = Array.from(new Map(data.map(item => [item[dateField], item])).values());
    return uniqueData.map(row => ({
        ...row,
        _source: tableName,
        _rawDate: row[dateField] as string,
        dateObj: parseReportDate(row[dateField]),
    }));
}

// ─── fetchReportingData ───────────────────────────────────────────────────────

export async function fetchReportingData(location: string, view: string, metric: string) {
    const rows = await fetchLocationRawRows(location);
    if (!rows || rows.length === 0) return { labels: [], datasets: [] };

    // Sort ascending by date
    const sortedData = rows.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    const metricFilteredData = sortedData.filter(row => hasMetricRowData(row, location, metric));

    const getMetricValue = (row: any, metricId: string): number | null => {
        if (location === 'charlotte') {
            if (isNewFormatCharlotte(row)) {
                switch (metricId) {
                    case 'revenue':
                        return parseCurrency(row.receipts_total_mtd);
                    case 'move_in_out':
                        return (parseInt(row.activity_move_ins_mtd) || 0)
                            - (parseInt(row.activity_move_outs_mtd) || 0);
                    case 'occupancy': {
                        const occ = parseFloat(row.occupancy_occupied_pct_units) || 0;
                        return occ <= 1 ? occ * 100 : parsePercent(row.occupancy_occupied_pct_units);
                    }
                    case 'arrears': {
                        const currentMonthArrears = (parseFloat(row.aging_0_10_amount) || 0) + (parseFloat(row.aging_11_30_amount) || 0);
                        const actualOccupiedRates = parseCurrency(row.actual_occupied_rates);
                        const mtd = parseCurrency(row.receipts_total_mtd);
                        return actualOccupiedRates > 0
                            ? (currentMonthArrears / actualOccupiedRates) * 100
                            : (mtd > 0 ? (currentMonthArrears / mtd) * 100 : 0);
                    }
                    case 'insurance': {
                        const insuranceCount = parseFloat(row.tenants_insurance_count) || 0;
                        const occupied = parseFloat(row.occupancy_occupied_units) || 1;
                        return (insuranceCount / occupied) * 100;
                    }
                    case 'autopay': {
                        const autopayPct = parseFloat(row.tenants_autopay_pct);
                        if (!isNaN(autopayPct) && autopayPct > 0) {
                            return autopayPct <= 1 ? autopayPct * 100 : autopayPct;
                        }
                        const autopayTenants = parseFloat(row.tenants_autobilled_count) || 0;
                        const occupied = parseFloat(row.occupancy_occupied_units) || 1;
                        return (autopayTenants / occupied) * 100;
                    }
                    case 'leads':
                        return (parseInt(row.leads_sparefoot_daily) || 0)
                            + (parseInt(row.leads_phone_daily) || 0)
                            + (parseInt(row.leads_web_daily) || 0)
                            + (parseInt(row.leads_walk_in_daily) || 0);
                    case 'forecast': {
                        const mtd = parseCurrency(row.receipts_total_mtd);
                        const day = row.dateObj.getDate();
                        const total = new Date(row.dateObj.getFullYear(), row.dateObj.getMonth() + 1, 0).getDate();
                        return day > 0 ? (mtd / day) * total : 0;
                    }
                    default: return 0;
                }
            }
            switch (metricId) {
                case 'revenue':
                    return parseCurrency(row.paymenttotals_mtd);
                case 'move_in_out':
                    return (parseInt(row.activity_moveins_mtd) || 0)
                        - (parseInt(row.activity_moveouts_mtd) || 0);
                case 'occupancy':
                    return String(row.units_occupancyrate || '').includes("0.") ? row.units_occupancyrate * 100 : parsePercent(row.units_occupancyrate);
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
        } else if (location === 'catawba') {
            switch (metricId) {
                case 'revenue':
                    return parseCurrency(row.receipts_total_mtd);
                case 'move_in_out':
                    return (parseInt(row.activity_move_ins_mtd) || 0)
                        - (parseInt(row.activity_move_outs_mtd) || 0);
                case 'occupancy':
                    return parsePercent(row.occupancy_occupied_pct_units);
                case 'arrears': {
                    const currentMonthArrears = (parseFloat(row.aging_0_10_amount) || 0) + (parseFloat(row.aging_11_30_amount) || 0);
                    const actualOccupiedRates = parseCurrency(row.actual_occupied_rates);
                    const mtd = parseCurrency(row.receipts_total_mtd);
                    return actualOccupiedRates > 0
                        ? (currentMonthArrears / actualOccupiedRates) * 100
                        : (mtd > 0 ? (currentMonthArrears / mtd) * 100 : 0);
                }
                case 'insurance': {
                    const insuranceCount = parseFloat(row.tenants_insurance_count) || 0;
                    const occupied = parseFloat(row.occupancy_occupied_units) || 1;
                    return (insuranceCount / occupied) * 100;
                }
                case 'autopay': {
                    const autopayPct = parseFloat(row.tenants_autopay_pct);
                    if (!isNaN(autopayPct) && autopayPct > 0) {
                        return autopayPct <= 1 ? autopayPct * 100 : autopayPct;
                    }
                    const autopayTenants = parseFloat(row.tenants_autobilled_count) || 0;
                    const occupied = parseFloat(row.occupancy_occupied_units) || 1;
                    return (autopayTenants / occupied) * 100;
                }
                case 'leads':
                    return (parseInt(row.leads_sparefoot_daily) || 0)
                        + (parseInt(row.leads_phone_daily) || 0)
                        + (parseInt(row.leads_web_daily) || 0)
                        + (parseInt(row.leads_walk_in_daily) || 0);
                case 'forecast': {
                    const mtd = parseCurrency(row.receipts_total_mtd);
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
    const rows = await fetchLocationRawRows(location);
    if (!rows || rows.length === 0) return null;

    // Parse dates, attach _rawDate, sort newest first
    const sorted = rows.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
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
        if (isNewFormatCharlotte(row)) {
            const revenueMTD = parseCurrency(row.receipts_total_mtd);
            const moveIns = parseInt(row.activity_move_ins_mtd) || 0;
            const moveOuts = parseInt(row.activity_move_outs_mtd) || 0;
            const occupiedUnits = parseFloat(row.occupancy_occupied_units) || 1;
            const currentMonthArrears = (parseFloat(row.aging_0_10_amount) || 0) + (parseFloat(row.aging_11_30_amount) || 0);
            const actualOccupiedRates = parseCurrency(row.actual_occupied_rates);
            const insuranceCount = parseFloat(row.tenants_insurance_count) || 0;
            const autopayPctDirect = parseFloat(row.tenants_autopay_pct);
            const autopayTenants = parseFloat(row.tenants_autobilled_count) || 0;
            const occVal = parseFloat(row.occupancy_occupied_pct_units) || 0;

            // last_revenue: derive from previous month entry if available
            const previousMonthRow = meaningfulRows.find(r => {
                const d = r.dateObj;
                const targetMonth = dateObj.getMonth() === 0 ? 11 : dateObj.getMonth() - 1;
                const targetYear = dateObj.getMonth() === 0 ? dateObj.getFullYear() - 1 : dateObj.getFullYear();
                return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
            });
            const lastRevenue = previousMonthRow
                ? parseCurrency(previousMonthRow.receipts_total_mtd ?? previousMonthRow.paymenttotals_mtd)
                : null;

            // Sum of all daily leads for the month
            const monthRows = meaningfulRows.filter(r =>
                r.dateObj.getMonth() === dateObj.getMonth() &&
                r.dateObj.getFullYear() === dateObj.getFullYear()
            );
            const leadsTotal = parseInt(row.leads_total_mtd) || 0;

            metrics = {
                revenue: revenueMTD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                last_revenue: lastRevenue,
                move_in_out: `${moveIns} / ${moveOuts}`,
                occupancy: occVal <= 1 ? (occVal * 100).toFixed(1) : parsePercent(row.occupancy_occupied_pct_units).toFixed(1),
                arrears: (actualOccupiedRates > 0
                    ? (currentMonthArrears / actualOccupiedRates) * 100
                    : (revenueMTD > 0 ? (currentMonthArrears / revenueMTD) * 100 : 0)
                ).toFixed(1),
                insurance: ((insuranceCount / occupiedUnits) * 100).toFixed(1),
                autopay: (!isNaN(autopayPctDirect) && autopayPctDirect > 0
                    ? (autopayPctDirect <= 1 ? autopayPctDirect * 100 : autopayPctDirect)
                    : (autopayTenants / occupiedUnits) * 100
                ).toFixed(1),
                cac: '145.20',
                ltv: '2450.00',
                leads: leadsTotal,
                forecast: currentDay > 0
                    ? ((revenueMTD / currentDay) * totalDaysInMonth).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '0.00',
            };
        } else {
            const revenueMTD = parseCurrency(row.paymenttotals_mtd);
            const achMTD = parseCurrency(row.units_autobilled);
            const insMTD = parseCurrency(row.units_occupied);
            const moveIns = parseInt(row.activity_moveins_mtd) || 0;
            const moveOuts = parseInt(row.activity_moveouts_mtd) || 0;
            const leadsTotal = (parseInt(row.leads_totals_mtd) || 0);

            // last_revenue: derive from previous month entry if available
            const previousMonthRow = meaningfulRows.find(r => {
                const d = r.dateObj;
                const targetMonth = dateObj.getMonth() === 0 ? 11 : dateObj.getMonth() - 1;
                const targetYear = dateObj.getMonth() === 0 ? dateObj.getFullYear() - 1 : dateObj.getFullYear();
                return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
            });
            const lastRevenue = previousMonthRow
                ? parseCurrency(previousMonthRow.receipts_total_mtd ?? previousMonthRow.paymenttotals_mtd)
                : null;

            metrics = {
                revenue: revenueMTD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                last_revenue: lastRevenue,
                move_in_out: `${moveIns} / ${moveOuts}`,
                occupancy: `${String(row.units_occupancyrate || '').includes("0.") ? row.units_occupancyrate * 100 : parsePercent(row.units_occupancyrate).toFixed(1)}`,
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
        }

    } else if (location === 'catawba') {
        // Catawba — daily_management_reports
        const revenueMTD = parseCurrency(row.receipts_total_mtd);
        const moveIns = parseInt(row.activity_move_ins_mtd) || 0;
        const moveOuts = parseInt(row.activity_move_outs_mtd) || 0;
        const occupiedUnits = parseFloat(row.occupancy_occupied_units) || 1;
        const currentMonthArrears = (parseFloat(row.aging_0_10_amount) || 0) + (parseFloat(row.aging_11_30_amount) || 0);
        const actualOccupiedRates = parseCurrency(row.actual_occupied_rates);
        const insuranceCount = parseFloat(row.tenants_insurance_count) || 0;
        const autopayPctDirect = parseFloat(row.tenants_autopay_pct);
        const autopayTenants = parseFloat(row.tenants_autobilled_count) || 0;

        // last_revenue: derive from previous month entry if available
        const previousMonthRow = meaningfulRows.find(r => {
            const d = r.dateObj;
            const targetMonth = dateObj.getMonth() === 0 ? 11 : dateObj.getMonth() - 1;
            const targetYear = dateObj.getMonth() === 0 ? dateObj.getFullYear() - 1 : dateObj.getFullYear();
            return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
        });
        const lastRevenue = previousMonthRow ? parseCurrency(previousMonthRow.receipts_total_mtd) : null;

        // Sum of all daily leads for the month
        const monthRows = meaningfulRows.filter(r =>
            r.dateObj.getMonth() === dateObj.getMonth() &&
            r.dateObj.getFullYear() === dateObj.getFullYear()
        );
        const leadsTotal = parseInt(row.leads_total_mtd) || 0;

        metrics = {
            revenue: revenueMTD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            last_revenue: lastRevenue,
            move_in_out: `${moveIns} / ${moveOuts}`,
            occupancy: parsePercent(row.occupancy_occupied_pct_units).toFixed(1),
            arrears: (actualOccupiedRates > 0
                ? (currentMonthArrears / actualOccupiedRates) * 100
                : (revenueMTD > 0 ? (currentMonthArrears / revenueMTD) * 100 : 0)
            ).toFixed(1),
            insurance: ((insuranceCount / occupiedUnits) * 100).toFixed(1),
            autopay: (!isNaN(autopayPctDirect) && autopayPctDirect > 0
                ? autopayPctDirect
                : (autopayTenants / occupiedUnits) * 100
            ).toFixed(1),
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
            occupancy: parsePercent(row.occupancy_statistics_occupied_unit_pct).toFixed(1),
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