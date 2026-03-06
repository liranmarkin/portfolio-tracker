'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatUSD, formatPercent } from '@/lib/format';

interface Slice {
  name: string;
  value: number;
}

const COLORS = ['#34d399', '#60a5fa', '#f59e0b', '#a78bfa', '#f87171', '#2dd4bf', '#fb923c', '#818cf8'];

export function AllocationDonut({ data, title }: { data: Slice[]; title: string }) {
  return (
    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">{title}</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              dataKey="value"
              stroke="#0f0f0f"
              strokeWidth={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e4e4e7',
                borderRadius: '8px',
                color: '#18181b',
              }}
              labelStyle={{ color: '#18181b', fontWeight: 600 }}
              itemStyle={{ color: '#18181b' }}
              formatter={(value, name) => [formatUSD(value as number), name as string]}
            />
            <Legend
              formatter={(value: string, entry) => {
                const total = data.reduce((s, d) => s + d.value, 0);
                const item = data.find(d => d.name === value);
                const pct = item ? formatPercent((item.value / total) * 100) : '';
                return <span className="text-zinc-300 text-xs">{value} ({pct})</span>;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
