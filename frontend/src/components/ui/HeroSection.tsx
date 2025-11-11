import { MeshGradient } from "@paper-design/shaders-react"
import { useEffect, useState } from "react"

interface HeroSectionProps {
  title?: string
  highlightText?: string
  description?: string
  buttonText?: string
  onButtonClick?: () => void
  colors?: string[]
  distortion?: number
  swirl?: number
  speed?: number
  offsetX?: number
  className?: string
  titleClassName?: string
  descriptionClassName?: string
  buttonClassName?: string
  maxWidth?: string
  veilOpacity?: string
  fontFamily?: string
  fontWeight?: number
  rightContent?: React.ReactNode
  customButton?: React.ReactNode
}

export function HeroSection({
  title = "Intelligent AI Agents for",
  highlightText = "Smart Brands",
  description = "Transform your brand and evolve it through AI-driven brand guidelines and always up-to-date core components.",
  buttonText = "Join Waitlist",
  onButtonClick,
  colors = ["#72b9bb", "#b5d9d9", "#ffd1bd", "#ffebe0", "#8cc5b8", "#dbf4a4"],
  distortion = 0.8,
  swirl = 0.6,
  speed = 0.42,
  offsetX = 0.08,
  className = "",
  titleClassName = "",
  descriptionClassName = "",
  buttonClassName = "",
  maxWidth = "max-w-6xl",
  veilOpacity = "bg-white/20 dark:bg-black/25",
  fontFamily = "Satoshi, sans-serif",
  fontWeight = 500,
  rightContent,
  customButton,
}: HeroSectionProps) {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const update = () =>
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const handleButtonClick = () => {
    if (onButtonClick) {
      onButtonClick()
    }
  }

  return (
    <section className={`relative w-full min-h-screen overflow-hidden bg-background flex items-center justify-center ${className}`}>
      <div className="fixed inset-0 w-screen h-screen z-0">
        {mounted && (
          <>
            <MeshGradient
              width={dimensions.width}
              height={dimensions.height}
              colors={colors}
              distortion={distortion}
              swirl={swirl}
              grainMixer={0}
              grainOverlay={0}
              speed={speed}
              offsetX={offsetX}
            />
            <div className={`absolute inset-0 pointer-events-none z-10 ${veilOpacity}`} />
          </>
        )}
      </div>
      
      <div className={`relative z-20 w-full mx-auto px-12`}>
        {rightContent ? (
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-[1fr_auto] gap-16 items-center justify-items-start lg:justify-items-start justify-items-center">
              <div className="flex flex-col space-y-8 lg:items-start items-center lg:text-left text-center">
                <h1
                  className={`font-bold text-foreground text-balance leading-[1.1] text-5xl sm:text-6xl lg:text-[4.8rem] ${titleClassName}`}
                  style={{ fontFamily, fontWeight }}
                >
                  {title} <span className="text-primary">{highlightText}</span>
                </h1>
                <p className={`text-xl text-white/90 leading-relaxed max-w-xl ${descriptionClassName}`}>
                  {description}
                </p>
                <div>
                  {customButton || (
                    <button
                      onClick={handleButtonClick}
                      className={`px-8 py-4 rounded-full border-4 bg-[rgba(63,63,63,1)] border-card text-base text-white hover:bg-[rgba(63,63,63,0.9)] transition-colors ${buttonClassName}`}
                    >
                      {buttonText}
                    </button>
                  )}
                </div>
              </div>
              <div className="relative flex items-center justify-center lg:justify-start lg:left-[-100px] left-0">
                {rightContent}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <h1
              className={`font-bold text-foreground text-balance text-4xl sm:text-5xl md:text-6xl xl:text-[80px] leading-tight sm:leading-tight md:leading-tight lg:leading-tight xl:leading-[1.1] mb-6 lg:text-7xl ${titleClassName}`}
              style={{ fontFamily, fontWeight }}
            >
              {title} <span className="text-primary">{highlightText}</span>
            </h1>
            <p className={`text-lg sm:text-xl text-white text-pretty max-w-2xl mx-auto leading-relaxed mb-10 px-4 ${descriptionClassName}`}>
              {description}
            </p>
            <button
              onClick={handleButtonClick}
              className={`px-6 py-4 sm:px-8 sm:py-6 rounded-full border-4 bg-[rgba(63,63,63,1)] border-card text-sm sm:text-base text-white hover:bg-[rgba(63,63,63,0.9)] transition-colors ${buttonClassName}`}
            >
              {buttonText}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
