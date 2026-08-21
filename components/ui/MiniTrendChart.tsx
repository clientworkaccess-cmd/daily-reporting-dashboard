"use client";

import type { TrendSeries } from "@/types/dashboard";
import { cleanLines, getCssVar } from "@/lib/utils";
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface MiniTrendChartProps {
  lines: TrendSeries[];
  dayCount?: number;
  locationId?: string;
}

function fitPoints(points: Array<number | null>, targetLength: number) {
  if (points.length === targetLength) {
    return points;
  }
  if (points.length > targetLength) {
    return points.slice(0, targetLength);
  }
  return [...points, ...Array.from({ length: targetLength - points.length }, () => null)];
}

export function MiniTrendChart({ lines, dayCount, locationId }: MiniTrendChartProps) {
  const normalizedLines = cleanLines(lines);
  if (normalizedLines.length === 0) {
    return <div className="flex h-[112px] w-full items-center justify-center text-[10px] text-slate-400">No data</div>;
  }

  const pointCount = Math.max(2, dayCount ?? 0, ...normalizedLines.map((line) => line.points.length));
  const labels = Array.from({ length: pointCount }, (_, index) => `${index + 1}`);

  const varName = locationId ? `--color-loc-${locationId.replace(/_/g, "-")}` : "--color-loc-charlotte";
  const FALLBACKS: Record<string, string> = {
    charlotte: "#3A8DDE",
    houston: "#FFC557",
    catawba: "#1d7d9c",
    rock_hill: "#3ca7c7",
  };
  const fallbackColor = (locationId && FALLBACKS[locationId]) || "#3A8DDE";
  const baseColorHex = getCssVar(varName, fallbackColor);

  const chartLabelColor = getCssVar("--color-chart-label", "#9aa4b2");
  const chartGridColor = getCssVar("--color-chart-grid-light", "#eef2f7");
  const tooltipBg = getCssVar("--color-chart-tooltip-bg-dark", "rgba(15, 23, 42, 0.92)");
  const tooltipTitle = getCssVar("--color-chart-tooltip-title-dark", "#ffffff");
  const tooltipBody = getCssVar("--color-chart-tooltip-body-dark", "#e2e8f0");

  const chartData = {
    labels,
    datasets: normalizedLines.map((series, index) => {
      const total = normalizedLines.length;
      const opacity = total > 1 ? (0.30 + (index / total) * 0.75) : 1;
      const opacityHex = Math.round(opacity * 255).toString(16).padStart(2, "0");
      const borderColor = baseColorHex.startsWith("#") ? (baseColorHex + opacityHex) : baseColorHex;

      return {
        label: series.label,
        data: fitPoints(series.points, pointCount),
        borderColor,
        backgroundColor: "transparent",
        borderWidth: index === normalizedLines.length - 1 ? 2.4 : 1.8,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointHitRadius: 10,
        tension: 0.35,
        spanGaps: true,
      };
    }),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: "bottom" as const,
        labels: {
          color: chartLabelColor,
          font: {
            size: 10,
            weight: 500,
            family: "'Inter', sans-serif",
          },
          boxWidth: 10,
          boxHeight: 10,
        },
      },
      tooltip: {
        enabled: true,
        backgroundColor: tooltipBg,
        titleColor: tooltipTitle,
        bodyColor: tooltipBody,
        displayColors: false,
        filter: (item: any) => item.raw !== null && item.raw !== undefined && !Number.isNaN(Number(item.raw)),
        callbacks: {
          title: (items: any[]) => `Day ${items[0]?.label ?? ""}`,
          label: (ctx: any) =>
            `${ctx.dataset?.label ?? ""}: ${Number(ctx.raw).toFixed(1)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: chartLabelColor,
          font: { size: 8 },
          maxRotation: 0,
          autoSkip: false,
          callback: (_: unknown, index: number) => {
            const day = index + 1;
            return [1, 7, 14, 21, 28, pointCount].includes(day) ? `${day}` : "";
          },
        },
      },
      y: {
        grid: { color: chartGridColor },
        ticks: {
          color: chartLabelColor,
          font: { size: 8 },
          callback: (value: string | number) => {
            const num = Number(value);
            if (Math.abs(num) >= 1000) {
              return `${Math.round(num / 1000)}k`;
            }
            if (Math.abs(num) >= 100) {
              return `${Math.round(num)}`;
            }
            return `${Math.round(num)}`;
          },
        },
      },
    },
  };

  return (
    <div className="h-40 w-full">
      <Line data={chartData} options={options} />
    </div>
  );
}
