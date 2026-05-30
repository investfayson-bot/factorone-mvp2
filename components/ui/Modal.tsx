'use client'

import React, { useCallback, useEffect, useId, useRef } from 'react'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_WIDTH: Record<ModalSize, number> = {
  sm: 360,
  md: 440, // = largura padrão do .modal-box atual
  lg: 600, // = NovaContaReceber/Pagar e NovaDespesa
  xl: 760,
}

export type ModalProps = {
  open: boolean
  onClose: () => void
  /** Título do cabeçalho. Se ausente, o cabeçalho some (a menos que showClose). */
  title?: React.ReactNode
  children: React.ReactNode
  /** Conteúdo do rodapé (botões). Renderizado dentro de .modal-actions. */
  footer?: React.ReactNode
  size?: ModalSize
  /** Fecha ao clicar no fundo. Default: true */
  closeOnBackdrop?: boolean
  /** Fecha com ESC. Default: true */
  closeOnEsc?: boolean
  /** Mostra o botão × no cabeçalho. Default: true */
  showClose?: boolean
  /** Classe extra no .modal-box */
  className?: string
  /** Rótulo acessível quando não há `title` textual */
  ariaLabel?: string
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEsc = true,
  showClose = true,
  className,
  ariaLabel,
}: ModalProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden' // trava scroll do fundo
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, closeOnEsc, onClose])

  const onBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdrop && e.target === e.currentTarget) onClose()
    },
    [closeOnBackdrop, onClose]
  )

  if (!open) return null

  const hasHeader = Boolean(title) || showClose

  return (
    <div className="modal-bg" onClick={onBackdrop}>
      <div
        ref={boxRef}
        className={className ? `modal-box ${className}` : 'modal-box'}
        style={{ width: SIZE_WIDTH[size], maxHeight: '90vh', overflowY: 'auto' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        {hasHeader && (
          <div className="modal-title" id={title ? titleId : undefined}>
            <span>{title}</span>
            {showClose && (
              <button type="button" className="modal-close" aria-label="Fechar" onClick={onClose}>
                ×
              </button>
            )}
          </div>
        )}
        {children}
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  )
}
