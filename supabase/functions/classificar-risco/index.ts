// Classifica o risco de churn dos clientes pendentes via OpenAI (modelo barato).
// Secrets: supabase secrets set OPENAI_API_KEY=... [OPENAI_MODEL=gpt-4o-mini]
// Se a OpenAI falhar para um cliente, cai no calculo por regras (04_score_provisorio.sql).
import { createClient } from 'npm:@supabase/supabase-js@2'

const CODIGOS = ['QUEDA_USO', 'TICKETS_CRITICOS', 'NPS_BAIXO', 'CONTRATO_RECENTE']
const MODELO = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini'
const LOTE_MAX = 50
const CONCORRENCIA = 8
const PESOS: Record<string, number> = { QUEDA_USO: 0.35, TICKETS_CRITICOS: 0.25, NPS_BAIXO: 0.3, CONTRATO_RECENTE: 0.1 } // = catalogo fator

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
            'Voce mede a intensidade de cada fator de churn de um cliente SaaS B2B. Responda somente JSON: ' +
            '{"fatores": [{"fator_codigo": string, "valor_observado": numero, "intensidade": numero de 0 a 1}]}. ' +
            `fator_codigo deve ser um de ${CODIGOS.join(', ')}. intensidade 0 = sem problema, 1 = pior caso. Regua: ` +
            'QUEDA_USO: queda percentual de qtd_acessos do ultimo mes vs o anterior (0%=0, 50% ou mais=1; valor_observado = queda em %). ' +
            'TICKETS_CRITICOS: atendimentos ALTA/CRITICA nos ultimos 90 dias (0=0, 5 ou mais=1; valor_observado = quantidade). ' +
            'NPS_BAIXO: ultima nota (9-10=0, 7-8=0.2, 5-6=0.5, 3-4=0.75, 0-2=1; valor_observado = nota). ' +
            'CONTRATO_RECENTE: meses desde data_inicio_contrato (12 ou mais=0, 6=0.5, 0=1; valor_observado = meses). ' +
            'Omita fatores sem dado para avaliar. Sem nenhum dado, devolva {"fatores": []}.',
        },
        { role: 'user', content: JSON.stringify(dados) },
      ],
    }),
  })
  if (!r.ok) throw new Error(`OpenAI ${r.status}`)
  const j = JSON.parse((await r.json()).choices[0].message.content)
  // Score deterministico: soma(peso_padrao * intensidade). A IA so mede a intensidade de cada fator.
  const fatores = (j.fatores ?? [])
    .filter((f: { fator_codigo: string; intensidade: number }) => CODIGOS.includes(f.fator_codigo) && f.intensidade >= 0 && f.intensidade <= 1)
    .map((f: { fator_codigo: string; valor_observado: number; intensidade: number }) => ({
      fator_codigo: f.fator_codigo,
      valor_observado: f.valor_observado,
      contribuicao: Math.round(PESOS[f.fator_codigo] * f.intensidade * 10000) / 10000,
    }))
    .filter((f: { contribuicao: number }) => f.contribuicao > 0)
  const score = Math.min(1, fatores.reduce((t: number, f: { contribuicao: number }) => t + f.contribuicao, 0))
  return { score, fatores }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // So usuario logado dispara; a leitura/gravacao usa a service role (processo do sistema, fora do RLS).
  const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: u } = await auth.auth.getUser()
  if (!u.user) return Response.json({ erro: 'Nao autenticado' }, { status: 401, headers: cors })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: pend, error } = await db.rpc('fn_clientes_para_atualizar')
  if (error) return Response.json({ erro: error.message }, { status: 400, headers: cors })

  const ids: number[] = pend.slice(0, LOTE_MAX).map((p: { cliente_id: number }) => p.cliente_id)
  let ia = 0, regras = 0, mudaramNivel = 0
  console.log(`pendentes: ${pend.length}, processando ${ids.length}, modelo ${MODELO}, chave OpenAI ${Deno.env.get('OPENAI_API_KEY') ? 'definida' : 'AUSENTE'}`)

  const processar = async (id: number) => {
    const { data: anterior } = await db
      .from('analise_risco')
      .select('nivel_risco')
      .eq('cliente_id', id)
      .eq('vigente', true)
      .maybeSingle()
    try {
      const [cli, uso, aten, nps] = await Promise.all([
        db.from('cliente').select('segmento, plano, valor_mensal, data_inicio_contrato').eq('id', id).single(),
        db.from('dado_uso').select('competencia, qtd_acessos, minutos_uso, qtd_usuarios_ativos').eq('cliente_id', id).order('competencia', { ascending: false }).limit(6),
        db.from('atendimento').select('criticidade, status, aberto_em, tempo_resposta_horas').eq('cliente_id', id).order('aberto_em', { ascending: false }).limit(30),
        db.from('avaliacao_nps').select('nota, data_coleta').eq('cliente_id', id).order('data_coleta', { ascending: false }).limit(3),
      ])
      if (cli.error) throw new Error(cli.error.message)
      const vazio = !uso.data?.length && !aten.data?.length && !nps.data?.length
      const r = vazio
        ? { score: null, fatores: [] }
        : await perguntar({ hoje: new Date().toISOString().slice(0, 10), cliente: cli.data, uso: uso.data, atendimentos: aten.data, nps: nps.data })
      if (r.score === null) console.warn(`cliente ${id}: score nulo (vazio=${vazio})`)
      const { error: e } = await db.rpc('fn_calcular_risco_cliente', {
        p_cliente_id: id, p_score: r.score, p_fatores: r.fatores, p_origem: 'IMPORTACAO',
      })
      if (e) throw new Error(e.message)
      ia++
    } catch (e) {
      console.error(`cliente ${id}: IA falhou, usando regras:`, e instanceof Error ? e.message : e)
      const { error: ef } = await db.rpc('fn_calcular_score_provisorio', { p_cliente_id: id })
      if (ef) console.error(`cliente ${id}: fallback falhou:`, ef.message)
      regras++
    }

    const { data: atual } = await db
      .from('analise_risco')
      .select('nivel_risco')
      .eq('cliente_id', id)
      .eq('vigente', true)
      .maybeSingle()
    if (anterior && atual && anterior.nivel_risco !== atual.nivel_risco) mudaramNivel++
  }

  // Em lotes de CONCORRENCIA clientes por vez: ~48 clientes em poucos segundos.
  for (let i = 0; i < ids.length; i += CONCORRENCIA) {
    await Promise.all(ids.slice(i, i + CONCORRENCIA).map(processar))
  }

  return Response.json({
    processados: ids.length,
    mudaram_nivel: mudaramNivel,
    ia,
    regras,
    restantes: pend.length - ids.length,
  }, { headers: cors })
})
