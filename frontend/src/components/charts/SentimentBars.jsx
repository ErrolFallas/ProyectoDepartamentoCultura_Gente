import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from 'recharts';

const COLORS = {
  pct_positivo: '#22c55e',
  pct_neutro: '#94a3b8',
  pct_negativo: '#ef4444'
};

/**
 * Gráfico apilado de % positivo/neutro/negativo. Acepta una lista de
 * filas { label, pct_positivo, pct_neutro, pct_negativo, n }.
 */
export function SentimentBars({ rows, height = 320 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
        <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="pct_positivo" name="Positivo" stackId="s" fill={COLORS.pct_positivo} />
        <Bar dataKey="pct_neutro" name="Neutro" stackId="s" fill={COLORS.pct_neutro} />
        <Bar dataKey="pct_negativo" name="Negativo" stackId="s" fill={COLORS.pct_negativo}>
          {rows.map((_, i) => <Cell key={i} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
