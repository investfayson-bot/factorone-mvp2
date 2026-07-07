import Anthropic from '@anthropic-ai/sdk'

// Núcleo de tool-use compartilhado pelos 3 canais da Donna (e-mail, site,
// telegram). Cada canal define seu próprio conjunto de tools e interpreta o
// resultado — a enforcement de autonomia (automático vs rascunho) SEMPRE
// acontece no código de quem chama, nunca aqui: o modelo pode "pedir" uma
// ação, mas quem decide se ela vira realidade é a regra do usuário.

let cliente: Anthropic | null = null
function anthropic(): Anthropic {
  if (!cliente) cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  return cliente
}

export type ToolDef = { name: string; description: string; input_schema: Anthropic.Tool.InputSchema }
export type DecisaoAgente = { tool: string; input: Record<string, unknown> } | null

export async function decidirAcao(opts: {
  system: string
  mensagem: string
  tools: ToolDef[]
  model?: string
}): Promise<DecisaoAgente> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  try {
    const resp = await anthropic().messages.create({
      model: opts.model ?? 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: opts.system,
      tools: opts.tools,
      tool_choice: { type: 'any' },
      messages: [{ role: 'user', content: opts.mensagem }],
    })
    const bloco = resp.content.find(b => b.type === 'tool_use')
    if (!bloco || bloco.type !== 'tool_use') return null
    return { tool: bloco.name, input: bloco.input as Record<string, unknown> }
  } catch {
    return null
  }
}
