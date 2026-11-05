"use client"

import * as React from "react"
import { RotateCcwSquare, RotateCwSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * Turning a card on screen, a quarter at a time.
 *
 * Some designs are laid out sideways on a face: a portrait card whose back reads
 * across its long edge, or the reverse. Flipping cannot help with those, so every
 * card viewer also lets the operator rotate what they are looking at. It changes
 * the view only. The artwork, the download and the print sheet are untouched.
 *
 * ### One angle per face
 *
 * A card can be upright on the front and sideways on the back, so each face keeps
 * its own angle: turn the back once and it is still turned after flipping away
 * and returning, while the front stays as it was.
 *
 * ### Two buttons rather than a vertical/horizontal switch
 *
 * A design can be sideways in either direction, and a switch that only knows one
 * would show the other kind upside down with no way to correct it. Left and right
 * always reach the readable angle, and the opposite button undoes a press.
 *
 * ### Every face shares one box
 *
 * The box is the card at its natural proportions, sized from the frame the
 * *showing* face needs, and a face only ever differs from the other by its angle
 * and scale. So neither is ever cropped or squashed, even while the outgoing one
 * is still in view during a flip into a frame of the other shape.
 */

type Face = "front" | "back"

export function useCardTurns(showing: Face) {
  const [turns, setTurns] = React.useState<Record<Face, number>>({ front: 0, back: 0 })

  return {
    /** Quarter turns per face. Unbounded, so CSS always takes the short way round. */
    turns,
    /** Whether the showing face currently stands across its natural shape. */
    sideways: turns[showing] % 2 !== 0,
    rotate: (by: 1 | -1) =>
      setTurns((current) => ({ ...current, [showing]: current[showing] + by })),
  }
}

/**
 * The frame's CSS width.
 *
 * `limit` is how wide the card may be upright. Sideways it divides by the ratio,
 * which keeps the card at the same scale: the point of turning a card is to read
 * it, and letting its long edge shrink to the upright width would make the text
 * smaller at the moment it finally faces the right way.
 */
export function frameWidth(limit: string, ratio: number, sideways: boolean): string {
  return sideways ? `min(100%, calc(${limit} / ${ratio}))` : `min(100%, ${limit})`
}

export function TurningFace({
  ratio,
  sideways,
  quarterTurns,
  className,
  children,
}: {
  /** The card's natural width ÷ height. */
  ratio: number
  /** Whether the frame is turned, i.e. whether the *showing* face is sideways. */
  sideways: boolean
  /** This face's own angle. */
  quarterTurns: number
  className?: string
  children: React.ReactNode
}) {
  // A face standing across the frame is the hidden one. Left at full size it
  // would stick out past the frame, unseen but still on top of whatever is there:
  // it blocks clicks on the buttons below and adds scroll height to a dialog. So
  // it shrinks to fit, and the showing face always fits as it is.
  const fits = quarterTurns % 2 !== 0 === sideways
  const scale = fits ? 1 : Math.min(ratio, 1 / ratio)

  return (
    <div
      className={cn(
        "absolute backface-hidden",
        "transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        "motion-reduce:transition-none",
        className
      )}
      style={{
        left: "50%",
        top: "50%",
        width: sideways ? `${ratio * 100}%` : "100%",
        height: sideways ? `${100 / ratio}%` : "100%",
        transform: `translate(-50%, -50%) rotate(${quarterTurns * 90}deg) scale(${scale})`,
      }}
    >
      {children}
    </div>
  )
}

/** Pinned to LTR: left and right are physical here, in either language. */
export function RotateButtons({ onRotate }: { onRotate: (by: 1 | -1) => void }) {
  const t = useT()

  const button = (
    label: string,
    Icon: typeof RotateCcwSquare,
    by: 1 | -1
  ) => (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 md:size-8"
            aria-label={label}
            onClick={() => onRotate(by)}
          >
            <Icon strokeWidth={1.75} />
          </Button>
        }
      />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )

  return (
    <div dir="ltr" className="flex items-center gap-1">
      {button(t("issue.rotateLeft"), RotateCcwSquare, -1)}
      {button(t("issue.rotateRight"), RotateCwSquare, 1)}
    </div>
  )
}
