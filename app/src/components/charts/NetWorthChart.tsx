'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatUSD } from '@/lib/format';
import type { AppConfig } from '@/lib/data';

interface DataPoint {
  date: string;
  value: number; // always USD
}

function fmtValue(usd: number, config?: AppConfig, rate?: number): string {
  if (!config || !rate) return formatUSD(usd);
  if (config.base_currency === 'blended') {
    return Object.entries(config.blended)
      .map(([c, w]) => c === 'ILS' ? `₪${Math.round(usd * rate * w).toLocaleString('en-US')}` : formatUSD(usd * w))
      .join(' + ');
  }
  if (config.base_currency === 'ILS') return `₪${Math.round(usd * rate).toLocaleString('en-US')}`;
  return formatUSD(usd);
}

export function NetWorthChart({ data, config, rate }: {
  data: DataPoint[];
  config?: AppConfig;
  rate?: number;
}) {
  return (
    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">Net Worth Over Time</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#a1a1aa', fontSize: 12 }}
              axisLine={{ stroke: '#3f3f46' }}
            />
            <YAxis
              tick={{ fill: '#a1a1aa', fontSize: 12 }}
              axisLine={{ stroke: '#3f3f46' }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #34d399',
                borderRadius: '10px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                padding: '10px 14px',
              }}
              labelStyle={{ color: '#a1a1aa', fontSize: 12, marginBottom: 4 }}
              itemStyle={{ color: '#34d399', fontWeight: 700, fontSize: 15 }}
              formatter={(value) => [fmtValue(value as number, config, rate), 'Net Worth']}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#34d399"
              strokeWidth={2}
              dot={{ fill: '#34d399', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
