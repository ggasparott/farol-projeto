import type { NivelRisco } from '../types'
import { ROTULO } from '../lib/risco'
const ESTILO: Record<NivelRisco, string> = { ALTO: 'border-[#efb6aa] bg-[#fff0ec] text-risco-alto', MEDIO: 'border-[#efd080] bg-[#fff6dc] text-risco-medio', BAIXO: 'border-[#acd8c1] bg-[#eaf8f0] text-risco-baixo', SEM_SCORE: 'border-[#bac9cf] bg-[#edf2f4] text-suave' }
const SIMBOLO: Record<NivelRisco, string> = { ALTO: '▲', MEDIO: '◆', BAIXO: '●', SEM_SCORE: '◌' }
export default function RiscoBadge({ nivel }: { nivel: NivelRisco }) { return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${ESTILO[nivel]}`}><span aria-hidden="true">{SIMBOLO[nivel]}</span>{ROTULO[nivel]}</span> }
