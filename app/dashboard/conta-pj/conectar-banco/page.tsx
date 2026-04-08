export default function ConectarBancoPage() {
  const bancos = ['Itaú', 'Bradesco', 'Banco do Brasil', 'Santander', 'Nubank', 'Inter']
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">Conectar Banco (Open Finance)</h1>
      <p className="text-slate-600">Prepare sua conexão para saldo e extrato unificado.</p>
      <div className="grid gap-3 md:grid-cols-3">
        {bancos.map((b) => (
          <div key={b} className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="font-semibold">{b}</p>
            <p className="text-xs text-slate-500">Open Finance em breve</p>
            <button className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">Conectar</button>
          </div>
        ))}
      </div>
    </div>
  )
}
