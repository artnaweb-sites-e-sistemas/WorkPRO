import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const APP = 'WorkPRO'

function titleForPath(pathname: string): string {
  if (pathname === '/login') return `${APP} — Entrar`
  if (pathname === '/') return APP
  if (pathname === '/ligacao') return `${APP} — Ligação`
  if (pathname === '/proposta' || pathname.startsWith('/proposta/')) return `${APP} — Proposta`
  if (pathname === '/piloto') return `${APP} — Novo Piloto`
  if (/^\/piloto\/[^/]+\/apresentar\/?$/.test(pathname)) return `${APP} — Apresentação`
  if (/^\/piloto\/[^/]+\/roteiro\/?$/.test(pathname)) return `${APP} — Roteiro`
  if (/^\/piloto\/[^/]+\/?$/.test(pathname)) return `${APP} — Piloto`
  if (pathname.startsWith('/conversa/')) return `${APP} — Conversa`
  return APP
}

/** Atualiza o título da aba conforme a rota. */
export function DocumentTitle() {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = titleForPath(pathname)
  }, [pathname])

  return null
}
