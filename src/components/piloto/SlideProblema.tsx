import type { SlideProps } from './slideTypes'

export function SlideProblema({ accent }: SlideProps) {
  return (
    <div className="flex h-full w-full items-center justify-center px-[100px] text-center">
      <p className="text-[64px] font-semibold leading-tight tracking-tight text-white">
        O problema não é falta de cliente. É que o caminho até você tem{' '}
        <span style={{ color: accent }}>buraco</span>.
      </p>
    </div>
  )
}
