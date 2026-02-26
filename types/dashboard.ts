export interface DailyReport {
    id: string;
    created_at: string;
    date: string;
    revenue: number;
    move_ins: number;
    move_outs: number;
    occupancy_rate: number;
    arrears_rate: number;
    insurance_rate: number;
    autopay_rate: number;
    cac: number;
    ltv: number;
    leads: number;
}

export type Location = "charlotte" | "houston";
export type ViewType = "daily" | "weekly" | "monthly";
