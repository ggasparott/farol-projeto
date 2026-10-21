// Classifica o risco de churn dos clientes pendentes via OpenAI (modelo barato).
// Secrets: supabase secrets set OPENAI_API_KEY=... [OPENAI_MODEL=gpt-4o-mini]
// Se a OpenAI falhar para um cliente, cai no calculo por regras (04_score_provisorio.sql).
import { createClient } from 'npm:@supabase/supabase-js@2'

const CODIGOS = ['QUEDA_USO', 'TICKETS_CRITICOS', 'NPS_BAIXO', 'CONTRATO_RECENTE']
const MODELO = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini'
const LOTE_MAX = 50

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function perguntar(dados: unknown) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
    body: JSON.stringify({
      model: MODELO,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Voce estima o risco de churn de um cliente SaaS B2B. Responda somente JSON: ' +
            '{"score": numero de 0 a 1, "fatores": [{"fator_codigo": string, "valor_observado": numero, "contribuicao": numero de 0 a 1}]}. ' +
            `fator_codigo deve ser um de ${CODIGOS.join(', ')}. Inclua so fatores que realmente elevam o risco. ` +
            'Sem dados suficientes para julgar, use {"score": null, "fatores": []}.',
        },
        { role: 'user', content: JSON.stringify(dados) },
      ],
    }),
  })
  if (!r.ok) throw new Error(`OpenAI ${r.status}`)
  const j = JSON.parse((await r.json()).choices[0].message.content)
  const score = j.score === null ? null : Number(j.score)
  if (score !== null && !(score >= 0 && score <= 1)) throw new Error('score invalido')
  const fatores = (j.fatores ?? []).filter(
    (f: { fator_codigo: string; contribuicao: number }) =>
      CODIGOS.includes(f.fator_codigo) && f.contribuicao >= 0 && f.contribuicao <= 1,
  )
  return { score, fatores }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Usa o JWT do usuario logado: respeita RLS quando ela existir.
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })

  const { data: pend, error } = await db.rpc('fn_clientes_para_atualizar')
  if (error) return Response.json({ erro: error.message }, { status: 400, headers: cors })

  const ids: number[] = pend.slice(0, LOTE_MAX).map((p: { cliente_id: number }) => p.cliente_id)
  let ia = 0, regras = 0

  for (const id of ids) {
    try {
      const [cli, uso, aten, nps] = await Promise.all([
        db.from('cliente').select('segmento, plano, valor_mensal, data_inicio_contrato').eq('id', id).single(),
        db.from('dado_uso').select('competencia, qtd_acessos, minutos_uso, qtd_usuarios_ativos').eq('cliente_id', id).order('competencia', { ascending: false }).limit(6),
        db.from('atendimento').select('criticidade, status, aberto_em, tempo_resposta_horas').eq('cliente_id', id).order('aberto_em', { ascending: false }).limit(30),
        db.from('avaliacao_nps').select('nota, data_coleta').eq('cliente_id', id).order('data_coleta', { ascending: false }).limit(3),
      ])
      const vazio = !uso.data?.length && !aten.data?.length && !nps.data?.length
      const r = vazio
        ? { score: null, fatores: [] }
        : await perguntar({ hoje: new Date().toISOString().slice(0, 10), cliente: cli.data, uso: uso.data, atendimentos: aten.data, nps: nps.data })
      const { error: e } = await db.rpc('fn_calcular_risco_cliente', {
        p_cliente_id: id, p_score: r.score, p_fatores: r.fatores, p_origem: 'IMPORTACAO',
      })
      if (e) throw new Error(e.message)
      ia++
    } catch (_) {
      await db.rpc('fn_calcular_score_provisorio', { p_cliente_id: id })
      regras++
    }
  }

  return Response.json({ processados: ids.length, ia, regras, restantes: pend.length - ids.length }, { headers: cors })
})
