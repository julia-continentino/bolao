"use client";
import { forwardRef } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { chartRows, datasetHasEstimates, formatNumber, seriesMeta } from "@/lib/charts";
import { DATA_NATURE_LABEL, DEFAULT_PALETTE, type ChartSpec, type DataNature, type Dataset } from "@/lib/types";

const AXIS = { fontSize: 11, fill: "#6b7280" };
const GRID = "#e5e7eb";

function TooltipBox({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color: string; payload: { nature: DataNature } }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  const nature = payload[0].payload.nature;
  return (
    <div className="rounded-md border border-ink-200 bg-white px-3 py-2 text-xs shadow-card">
      <div className="mb-1 font-semibold text-ink-900">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-ink-700">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="num font-semibold text-ink-900">{formatNumber(p.value, unit)}</span>
        </div>
      ))}
      {nature !== "historical" && <div className="mt-1 text-[10px] text-violet-700">{DATA_NATURE_LABEL[nature]}</div>}
    </div>
  );
}

export const ChartView = forwardRef<HTMLDivElement, { spec: ChartSpec; dataset: Dataset; height?: number; width?: number }>(function ChartView({ spec, dataset, height = 300, width }, ref) {
  const rows = chartRows(dataset, spec);
  const meta = seriesMeta(dataset, spec);
  const unit = spec.type === "stacked100" ? "%" : meta[0]?.unit ?? dataset.unit;
  const estimates = datasetHasEstimates(dataset);
  const tick = (v: number) => formatNumber(v, unit);

  if (spec.type === "table") {
    return (
      <div ref={ref} className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="bg-navy-800 text-left text-white"><th className="px-3 py-2 font-semibold">{dataset.dimension}</th>{meta.map((m) => <th key={m.key} className="px-3 py-2 text-right font-semibold">{m.label}<div className="font-normal text-navy-300">{m.unit}</div></th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i % 2 ? "bg-navy-50/60" : ""}>
                <td className="px-3 py-1.5 text-ink-900">{r.label}</td>
                {meta.map((m) => <td key={m.key} className="num px-3 py-1.5 text-right text-ink-900">{formatNumber(r[m.key] as number | null, m.unit)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {estimates && <p className="mt-1 text-[10px] text-ink-500">E = estimativa de terceiros · P = projeção própria</p>}
      </div>
    );
  }

  const common = { data: rows, margin: { top: 16, right: 16, left: 4, bottom: 4 } };
  const legend = spec.showLegend && meta.length > 1 ? <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "#374151" }} /> : null;
  const tooltip = <Tooltip content={<TooltipBox unit={unit} />} cursor={{ fill: "rgba(42,91,156,0.06)" }} />;
  let chart: React.ReactElement;

  if (spec.type === "pie") {
    const m = meta[0];
    chart = (
      <PieChart>
        <Pie data={rows} dataKey={m.key} nameKey="label" innerRadius="55%" outerRadius="80%" paddingAngle={1} stroke="#ffffff" strokeWidth={2} isAnimationActive={false}
          label={spec.showDataLabels ? (e: { name?: string; value?: number }) => `${e.name}: ${formatNumber(e.value ?? null, m.unit)}` : false} labelLine={spec.showDataLabels}>
          {rows.map((_, i) => <Cell key={i} fill={DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]} />)}
        </Pie>
        <Tooltip formatter={(v: number) => formatNumber(v, m.unit)} />
        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    );
  } else if (spec.type === "line" || spec.type === "area") {
    const Chart = spec.type === "line" ? LineChart : AreaChart;
    chart = (
      <Chart {...common}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={tick} width={56} />
        {tooltip}
        {legend}
        {meta.map((m) =>
          spec.type === "line" ? (
            <Line key={m.key} type="monotone" dataKey={m.key} name={m.label} stroke={m.color} strokeWidth={2} isAnimationActive={false} connectNulls
              dot={(p: { cx?: number; cy?: number; payload?: { estimate: boolean }; index?: number }) => <circle key={p.index} cx={p.cx} cy={p.cy} r={4} fill={p.payload?.estimate ? "#ffffff" : m.color} stroke={m.color} strokeWidth={2} />}>
              {spec.showDataLabels && <LabelList dataKey={m.key} position="top" formatter={tick} style={{ fontSize: 10, fill: "#374151" }} />}
            </Line>
          ) : (
            <Area key={m.key} type="monotone" dataKey={m.key} name={m.label} stroke={m.color} fill={m.color} fillOpacity={0.18} strokeWidth={2} isAnimationActive={false} />
          ),
        )}
      </Chart>
    );
  } else {
    const horizontal = spec.type === "bar";
    const stacked = spec.type === "stacked" || spec.type === "stacked100";
    chart = (
      <BarChart {...common} layout={horizontal ? "vertical" : "horizontal"} barCategoryGap="22%" barGap={2}>
        <CartesianGrid stroke={GRID} horizontal={!horizontal} vertical={horizontal} />
        {horizontal
          ? [
              <XAxis key="x" type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={tick} />,
              <YAxis key="y" type="category" dataKey="label" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} width={130} />,
            ]
          : [
              <XAxis key="x" dataKey="label" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />,
              <YAxis key="y" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={tick} width={56} domain={spec.type === "stacked100" ? [0, 100] : undefined} />,
            ]}
        {tooltip}
        {legend}
        {meta.map((m, si) => (
          <Bar key={m.key} dataKey={m.key} name={m.label} fill={m.color} stackId={stacked ? "s" : undefined} isAnimationActive={false} stroke="#ffffff" strokeWidth={stacked ? 1 : 0}
            radius={stacked ? (si === meta.length - 1 ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0) : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={44}>
            {rows.map((r, i) => <Cell key={i} fillOpacity={r.estimate ? 0.5 : 1} />)}
            {spec.showDataLabels && !stacked && <LabelList dataKey={m.key} position={horizontal ? "right" : "top"} formatter={tick} style={{ fontSize: 10, fill: "#374151" }} />}
          </Bar>
        ))}
      </BarChart>
    );
  }

  const h = spec.type === "bar" ? Math.max(height, rows.length * 34 + 60) : height;
  return (
    <div ref={ref} style={{ width: width ?? "100%" }}>
      <div style={{ width: "100%", height: h }}>
        {width ? <div style={{ width, height: h }}>{cloneSized(chart, width, h)}</div> : <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>}
      </div>
      {estimates && <p className="mt-1 text-[10px] text-ink-500">Marcadores vazados/barras claras e sufixos E/P indicam estimativas de terceiros (E) ou projeções próprias (P).</p>}
    </div>
  );
});

function cloneSized(el: React.ReactElement, width: number, height: number) {
  const C = el.type as React.ComponentType<Record<string, unknown>>;
  return <C {...(el.props as Record<string, unknown>)} width={width} height={height} />;
}
