"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export type TrendPoint = { label: string; value: number };

const TICK_STYLE = { fontSize: 12, fill: "#64748b" };
const TOOLTIP_CONTENT_STYLE = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 24px -4px rgba(15, 23, 42, 0.12)",
  fontSize: 13,
};
const TOOLTIP_LABEL_STYLE = { color: "#0f172a", fontWeight: 600, marginBottom: 4 };

/**
 * Grafik tren generik (area/line atau bar) dipakai di halaman Analitik &
 * Pendapatan - pengganti bar buatan tangan (div width% inline).
 */
export function TrendChart({
  data,
  variant = "area",
  color = "#4f46e5",
  valueFormatter = (v: number) => String(v),
  height = 240,
}: {
  data: TrendPoint[];
  variant?: "area" | "bar";
  color?: string;
  valueFormatter?: (value: number) => string;
  height?: number;
}) {
  const gradientId = `trend-fill-${color.replace("#", "")}`;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {variant === "bar" ? (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={TICK_STYLE} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={TICK_STYLE}
              width={44}
              tickFormatter={valueFormatter}
              allowDecimals={false}
            />
            <Tooltip
              formatter={(value) => valueFormatter(Number(value))}
              contentStyle={TOOLTIP_CONTENT_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              cursor={{ fill: "#f1f5f9" }}
            />
            <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={TICK_STYLE} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={TICK_STYLE}
              width={44}
              tickFormatter={valueFormatter}
            />
            <Tooltip
              formatter={(value) => valueFormatter(Number(value))}
              contentStyle={TOOLTIP_CONTENT_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
