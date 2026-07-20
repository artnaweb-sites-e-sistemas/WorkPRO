import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ConfirmDialog, type ConfirmDialogVariant } from '../components/ui/ConfirmDialog'

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmDialogVariant
}

export interface AlertOptions {
  title?: string
  message: string
  confirmLabel?: string
}

interface ConfirmRequest extends ConfirmOptions {
  type: 'confirm'
  resolve: (value: boolean) => void
}

interface AlertRequest extends AlertOptions {
  type: 'alert'
  resolve: () => void
}

type PendingRequest = ConfirmRequest | AlertRequest

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  alert: (options: AlertOptions) => Promise<void>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingRequest | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ type: 'confirm', ...options, resolve })
    })
  }, [])

  const alert = useCallback((options: AlertOptions) => {
    return new Promise<void>((resolve) => {
      setPending({ type: 'alert', ...options, resolve })
    })
  }, [])

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert])

  function handleConfirm() {
    if (!pending) {
      return
    }

    if (pending.type === 'confirm') {
      pending.resolve(true)
    } else {
      pending.resolve()
    }

    setPending(null)
  }

  function handleCancel() {
    if (!pending) {
      return
    }

    if (pending.type === 'confirm') {
      pending.resolve(false)
    } else {
      pending.resolve()
    }

    setPending(null)
  }

  const isOpen = pending !== null
  const isAlert = pending?.type === 'alert'
  const confirmLabel =
    pending?.confirmLabel ?? (isAlert ? 'OK' : 'Confirmar')
  const cancelLabel = pending?.type === 'confirm' ? (pending.cancelLabel ?? 'Cancelar') : undefined

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={isOpen}
        title={pending?.title ?? (isAlert ? 'Aviso' : 'Confirmar')}
        message={pending?.message ?? ''}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        variant={pending?.type === 'confirm' ? pending.variant : 'default'}
        alertOnly={isAlert}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  )
}

function useConfirmContext(): ConfirmContextValue {
  const context = useContext(ConfirmContext)

  if (!context) {
    throw new Error('useConfirm deve ser usado dentro de ConfirmProvider')
  }

  return context
}

export function useConfirm() {
  return useConfirmContext().confirm
}

export function useAlert() {
  return useConfirmContext().alert
}
