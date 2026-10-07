import type { NivelRisco } from '../types'
import { COR, ROTULO } from '../lib/risco'

export default function RiscoBadge({ nivel }: { nivel: NivelRisco }) {
  return (
    <span className={`inline-block border px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${COR[nivel]}`}>
      {ROTULO[nivel]}
    </span>
  )
}
