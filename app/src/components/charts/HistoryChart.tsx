'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatUSD } from '@/lib/format';
import type { AppConfig } from '@/lib/data';

interface DataPoint {
  date: string;
  value: number;
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

export function HistoryChart({ data, config, rate }: {
  data: DataPoint[];
  config?: AppConfig;
  rate?: number;
}) {
  return (
    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">Net Worth Timeline</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              domain={['dataMin - 10000', 'dataMax + 10000']}
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
            <Area
              type="monotone"
              dataKey="value"
              stroke="#34d399"
              strokeWidth={2}
              fill="url(#valueGradient)"
              dot={{ fill: '#34d399', r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
