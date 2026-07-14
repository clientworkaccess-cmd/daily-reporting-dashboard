"use client";

import { useState, useEffect } from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { fetchReportingData } from "@/lib/dataService";
import { getCssVar } from "@/lib/utils";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface ReportingChartProps {
    location: string;
    view: string;
    metric: string;
}

export default function ReportingChart({ location, view, metric }: ReportingChartProps) {
    const [chartData, setChartData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const COLORS = [
        getCssVar("--color-sky-seq-500", "#0ea5e9"),
        getCssVar("--color-sky-seq-600", "#0284c7"),
        getCssVar("--color-sky-seq-700", "#0369a1"),
        getCssVar("--color-sky-seq-800", "#075985"),
        getCssVar("--color-sky-seq-400", "#38bdf8"),
        getCssVar("--color-sky-seq-300", "#7dd3fc"),
        getCssVar("--color-sky-seq-200", "#bae6fd"),
        getCssVar("--color-sky-seq-100", "#e0f2fe"),
    ];

    const currentMonthColor = getCssVar("--color-sky-seq-500", "#0ea5e9");
    const tooltipBg = getCssVar("--color-chart-tooltip-bg-light", "rgba(255, 255, 255, 0.95)");
    const tooltipTitle = getCssVar("--color-chart-tooltip-title-light", "#1e293b");
    const tooltipBody = getCssVar("--color-chart-tooltip-body-light", "#475569");
    const tooltipBorder = getCssVar("--color-border-main", "#e2e8f0");
    const gridColor = getCssVar("--color-chart-grid-dark", "rgba(0, 0, 0, 0.05)");

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                const data = await fetchReportingData(location, view, metric);

                setChartData({
                    labels: data.labels,
                    datasets: data.datasets.map((ds: any, idx: number) => {
                        const total = data.datasets.length;
                        // Opacity: 1 for current month (last one), decreasing for past months
                        const opacity = total > 1 ? (0.2 + (idx / (total - 1)) * 0.8) : 1;
                        const color = ds.label === "Current Month" ? currentMonthColor : COLORS[idx % COLORS.length];

                        return {
                            ...ds,
                            borderColor: color + Math.round(opacity * 255).toString(16).padStart(2, '0'),
                            backgroundColor: color + Math.round(opacity * 0.1 * 255).toString(16).padStart(2, '0'),
                            tension: 0.4,
                            pointRadius: (ctx: any) => ctx.raw !== null ? 4 : 0,
                            pointHoverRadius: 6,
                            borderWidth: idx === total - 1 ? 3 : 2,
                            spanGaps: true, // Connect line across null/missing days
                        };
                    }),
                });
            } catch (error) {
                console.error("Failed to load chart data:", error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [location, view, metric, COLORS, currentMonthColor]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        spanGaps: true,
        plugins: {
            legend: {
                position: "bottom" as const,
                labels: {
                    padding: 20,
                    usePointStyle: true,
                    font: { size: 11, family: "Inter" },
                    filter: (item: any) => item.text !== undefined,
                },
            },
            tooltip: {
                backgroundColor: tooltipBg,
                titleColor: tooltipTitle,
                bodyColor: tooltipBody,
                borderColor: tooltipBorder,
                borderWidth: 1,
                padding: 12,
                displayColors: true,
                callbacks: {
                    label: (ctx: any) => {
                        if (ctx.raw === null || ctx.raw === undefined) return;
                        return ` ${ctx.dataset.label}: ${ctx.raw.toLocaleString()}`;
                    }
                }
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { font: { size: 11 } }
            },
            y: {
                grid: { color: gridColor },
                beginAtZero: true,
                ticks: {
                    font: { size: 11 },
                    callback: function (value: any) {
                        if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'k';
                        return value;
                    }
                }
            },
        },
    };

    if (loading || !chartData) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 rounded-xl animate-pulse">
                <div className="text-slate-400 font-medium">Loading analytics...</div>
            </div>
        );
    }

    return (
        <div className="w-full h-full">
            <Line data={chartData} options={options} />
        </div>
    );
}
