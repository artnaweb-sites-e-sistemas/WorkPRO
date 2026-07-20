import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from './Button'

/** Overlay compartilhado: desfoque da tela de fundo + leve escurecimento para contraste. */
export const dialogOverlayClassName =
  'fixed inset-0 flex items-center justify-center bg-black/25 backdrop-blur-md p-4'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  className?: string
  footer?: ReactNode
  /** Classe adicional para o overlay (ex: z-index maior em modais empilhados). */
  overlayClassName?: string
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  footer,
  overlayClassName,
}: DialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn(dialogOverlayClassName, 'z-50', overlayClassName)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={cn(
              'flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden border-2 border-border bg-surface',
              className,
            )}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="shrink-0 border-b-2 border-border px-6 py-5">
              <h2 className="kinetic-heading text-lg tracking-tight">{title}</h2>
              {description && (
                <p className="mt-2 text-sm normal-case text-muted-foreground">{description}</p>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
            {footer && (
              <div className="flex shrink-0 justify-end gap-3 border-t-2 border-border bg-surface px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function DialogCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClose}>
      Fechar
    </Button>
  )
}
