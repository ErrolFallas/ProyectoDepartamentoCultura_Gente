import { nivelColor } from '../../lib/format.js';

export function NivelPill({ nivel }) {
  return (
    <span className={`pill ${nivelColor(nivel)}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {nivel}
    </span>
  );
}
