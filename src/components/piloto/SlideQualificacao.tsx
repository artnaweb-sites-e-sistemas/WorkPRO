import type { SlideProps } from './slideTypes'

const QUALIFICATION_COPY =
  'A ferramenta responde quem chama, faz as perguntas certas e classifica o lead por temperatura. Ninguém fica sem resposta, e você só dedica tempo a quem realmente pode comprar.'

export function SlideQualificacao({ input }: SlideProps) {
  const shots = input.toolScreenshots.slice(0, 3)

  return (
    <div className="flex h-full w-full gap-12 px-[80px] py-[56px] text-white">
      <div className="flex w-[480px] flex-col justify-center">
        <h2 className="text-[40px] font-bold leading-tight tracking-tight">
          O que acontece com quem chama no WhatsApp
        </h2>
        <p className="mt-8 text-[22px] font-medium leading-snug text-[#D4D4D8]">
          {QUALIFICATION_COPY}
        </p>
      </div>

      <div className="flex flex-1 items-center justify-end gap-4">
        {shots.length > 0
          ? shots.map((src, index) => (
              <div
                key={index}
                className="flex h-[420px] w-[180px] items-center justify-center border border-[#3F3F46] bg-[#18181B]"
              >
                <img src={src} alt="" className="h-full w-full object-contain" />
              </div>
            ))
          : [0, 1, 2].map((index) => (
              <div
                key={index}
                className="flex h-[420px] w-[180px] items-center justify-center border border-dashed border-[#3F3F46] bg-transparent"
              >
                <p className="px-4 text-center text-[14px] font-medium text-[#71717A]">
                  Prints da ferramenta
                </p>
              </div>
            ))}
      </div>
    </div>
  )
}
