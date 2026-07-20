import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useId } from 'react'
import { cn } from '../../lib/cn'
import { Button } from './Button'
import { dialogOverlayClassName } from './Dialog'

export type ConfirmDialogVariant = 'default' | 'danger'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmDialogVariant
  alertOnly?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  alertOnly = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    if (!open) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn(dialogOverlayClassName, 'z-[60]')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          aria-hidden={false}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={messageId}
            className="w-full max-w-md border-2 border-border bg-surface shadow-none"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b-2 border-border px-6 py-5">
              <h2 id={titleId} className="kinetic-heading text-lg tracking-tight">
                {title}
              </h2>
            </div>

            <div className="px-6 py-6">
              <p id={messageId} className="text-sm normal-case leading-relaxed text-foreground">
                {message}
              </p>
            </div>

            <div
              className={cn(
                'flex items-stretch justify-end gap-3 border-t-2 border-border px-6 py-4',
                alertOnly && 'justify-stretch',
              )}
            >
              {!alertOnly && (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={onCancel}
                  className="min-w-[7rem] hover:border-foreground hover:bg-foreground hover:text-background"
                >
                  {cancelLabel}
                </Button>
              )}
              <Button
                type="button"
                variant={variant === 'danger' ? 'danger' : 'primary'}
                size="md"
                autoFocus
                onClick={onConfirm}
                className={cn(
                  'min-w-[7rem]',
                  alertOnly && 'w-full',
                  variant === 'danger' &&
                    'border-status-error bg-status-error text-white hover:border-status-error hover:bg-status-error/90 hover:text-white',
                )}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
