import { Suspense } from 'react'
import FinanceiroTabs from './FinanceiroTabs'

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Suspense fallback={<div className="h-12 border-b border-slate-200 bg-white" />}>
        <FinanceiroTabs />
      </Suspense>
      {children}
    </div>
  )
}
