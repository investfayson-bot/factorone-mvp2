export type ViaCepResponse = {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

export async function buscarCep(cepDigits: string): Promise<ViaCepResponse | null> {
  const clean = cepDigits.replace(/\D/g, '')
  if (clean.length !== 8) return null
  const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
  if (!res.ok) return null
  const data = (await res.json()) as ViaCepResponse
  if (data.erro) return null
  return data
}
