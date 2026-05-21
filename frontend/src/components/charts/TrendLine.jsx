import {
  LineChart, Line,
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

const COLORS = {
  positivo: '#22c55e',
  negativo: '#ef4444'
};

export function TrendLine({ rows, height = 280, tipo = 'linea' }) {
  const margin = { top: 8, right: 16, left: 0, bottom: 8 };
  const tooltipFmt = (v) => `${Number(v).toFixed(1)}%`;

  if (tipo === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={rows} margin={margin}>
          <defs>
            <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.positivo} stopOpacity={0.5} />
              <stop offset="100%" stopColor={COLORS.positivo} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradNeg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.negativo} stopOpacity={0.5} />
              <stop offset="100%" stopColor={COLORS.negativo} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
          <Tooltip formatter={tooltipFmt} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="pct_positivo" name="Positivo"
                stroke={COLORS.positivo} strokeWidth={2} fill="url(#gradPos)" />
          <Area type="monotone" dataKey="pct_negativo" name="Negativo"
                stroke={COLORS.negativo} strokeWidth={2} fill="url(#gradNeg)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (tipo === 'barras') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={margin}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
          <Tooltip formatter={tooltipFmt} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="pct_positivo" name="Positivo" fill={COLORS.positivo} radius={[3, 3, 0, 0]} />
          <Bar dataKey="pct_negativo" name="Negativo" fill={COLORS.negativo} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (tipo === 'apiladas') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={margin}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
          <Tooltip formatter={tooltipFmt} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="pct_positivo" name="Positivo" stackId="a" fill={COLORS.positivo} />
          <Bar dataKey="pct_neutro" name="Neutro" stackId="a" fill="#eab308" />
          <Bar dataKey="pct_negativo" name="Negativo" stackId="a" fill={COLORS.negativo} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Default: línea
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={margin}>
        <CartesianGrid stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
        <Tooltip formatter={tooltipFmt} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="pct_positivo" name="Positivo"
              stroke={COLORS.positivo} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="pct_negativo" name="Negativo"
              stroke={COLORS.negativo} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
