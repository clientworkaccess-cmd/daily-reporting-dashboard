"use client";

import type { TrendSeries } from "@/types/dashboard";
import { cleanLines } from "@/lib/utils";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

interface MiniTrendChartProps {
  lines: TrendSeries[];
}

export function MiniTrendChart({ lines }: MiniTrendChartProps) {
  const normalizedLines = cleanLines(lines);

  if (normalizedLines.length === 0) {
    return (
      <div className="flex h-[140px] w-full items-center justify-center text-[10px] text-slate-400">
        No data
      </div>
    );
  }

  const pointCount = Math.max(2, ...normalizedLines.map((l) => l.points.length));
  const labels = Array.from({ length: pointCount }, (_, i) => `${i + 1}`);

  const COLORS = ["#89c2ff", "#b495d6", "#6fa9c2", "#66cde0"] as const;

  const chartData = {
    labels,
    datasets: normalizedLines.map((series, idx) => ({
      label: series.label,
      data: series.points,
      borderColor: COLORS[idx % COLORS.length],
      backgroundColor: "transparent",
      borderWidth: idx === normalizedLines.length - 1 ? 2.4 : 1.8,
      pointRadius: 0,
      pointHoverRadius: 3,
      pointHitRadius: 10,
      tension: 0.35,
      spanGaps: true,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: {
        display: true,
        position: "bottom" as const,
        labels: {
          font: { size: 8 },
          boxWidth: 6,
          boxHeight: 6,
        },
      },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        titleColor: "#ffffff",
        bodyColor: "#e2e8f0",
        displayColors: false,
        callbacks: {
          title: (items: any[]) => `Day ${items[0]?.label ?? ""}`,
          label: (ctx: any) => {
            const month = ctx.dataset.label;
            const value = Number(ctx.raw).toLocaleString("en-US");

            return `${month}: ${value}`;
          },
        },
      },
    },

    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "#9aa4b2",
          font: { size: 8 },
          maxRotation: 0,
          autoSkip: false,
          callback: (_: unknown, idx: number) => {
            const d = idx + 1;
            return [1, 7, 14, 21, 28, pointCount].includes(d)
              ? `${d}`
              : "";
          },
        },
      },
      y: {
        grid: { color: "#eef2f7" },
        ticks: {
          color: "#9aa4b2",
          font: { size: 8 },
          callback: (v: string | number) => {
            const n = Number(v);
            if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}k`;
            if (Math.abs(n) >= 100) return `${Math.round(n)}`;
            return `${Math.round(n * 10) / 10}`;
          },
        },
      },
    },
  };

  return (
    <div className="h-[180px] w-full"> {/* 👈 height fix */}
      <Line data={chartData} options={options} />
    </div>
  );
}