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

const COLORS = [
    "#0ea5e9", // sky-500
    "#0284c7", // sky-600
    "#0369a1", // sky-700
    "#075985", // sky-800
    "#38bdf8", // sky-400
    "#7dd3fc", // sky-300
    "#bae6fd", // sky-200
    "#e0f2fe", // sky-100
];

export default function ReportingChart({ location, view, metric }: ReportingChartProps) {
    const [chartData, setChartData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

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
                        const color = ds.label === "Current Month" ? "#0ea5e9" : COLORS[idx % COLORS.length];

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
    }, [location, view, metric]);

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
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                titleColor: "#1e293b",
                bodyColor: "#475569",
                borderColor: "#e2e8f0",
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
                grid: { color: "rgba(0, 0, 0, 0.05)" },
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
