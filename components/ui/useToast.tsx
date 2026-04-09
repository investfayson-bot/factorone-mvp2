'use client'

import toast from 'react-hot-toast'

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

const baseStyle = {
  border: '1px solid var(--fo-border)',
  borderRadius: '12px',
  background: 'var(--fo-card)',
  color: 'var(--fo-text)',
  fontSize: '13px',
}

export function useToast() {
  function show(type: ToastType, message: string) {
    if (type === 'success') return toast.success(message, { duration: 4000, style: baseStyle })
    if (type === 'error') return toast.error(message, { duration: 4000, style: baseStyle })
    if (type === 'warning') {
      return toast(message, {
        duration: 4000,
        icon: '⚠️',
        style: { ...baseStyle, border: '1px solid var(--fo-warning)' },
      })
    }
    if (type === 'loading') return toast.loading(message, { style: baseStyle })
    return toast(message, { duration: 4000, style: baseStyle })
  }

  return {
    success: (m: string) => show('success', m),
    error: (m: string) => show('error', m),
    warning: (m: string) => show('warning', m),
    info: (m: string) => show('info', m),
    loading: (m: string) => show('loading', m),
    dismiss: (id?: string) => toast.dismiss(id),
  }
}
