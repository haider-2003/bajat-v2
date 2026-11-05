"use client"

import * as React from "react"
import { FlipHorizontal } from "lucide-react"

import { CardFaceRender } from "@/components/id-card/card-render"
import { CARD_SHADOW } from "@/components/id-card/card-stage"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { readDesign } from "@/features/templates/design"
import { serializeDesign } from "@/features/templates/editor-io"
import { useEditorStore } from "@/features/templates/editor-store"
import { sampleCardValues } from "@/features/templates/sample-values"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * The card as it stands right now, filled with fake data.
 *
 * The stage draws placeholders, so it cannot show whether a real name fits its
 * box or what a photo does to the layout. This does, and it gets there the long
 * way round on purpose: the live document goes through `serializeDesign` and
 * `readDesign`, then into `CardFaceRender`. That is the save format and the
 * issue form's own renderer, so the preview cannot disagree with them the way a
 * second drawing of the document eventually would.
 *
 * The card is one object that turns over, as it is on the issue form and the
 * printer's preview, and it opens on the face being worked on.
 */
export function PreviewDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The body subscribes to the document, so it must only exist while the
          dialog is open. The content's portal is what guarantees that. */}
      <DialogContent size="lg">
        <PreviewBody />
      </DialogContent>
    </Dialog>
  )
}

function PreviewBody() {
  const t = useT()
  const doc = useEditorStore((s) => s.doc)
  const variables = useEditorStore((s) => s.variables)
  const identityDuration = useEditorStore((s) => s.config.identityDuration)
  const startOnBack = useEditorStore((s) => s.activePage !== 0)

  const [flipped, setFlipped] = React.useState(startOnBack)

  const design = React.useMemo(
    () => readDesign(serializeDesign(doc, variables)),
    [doc, variables]
  )

  const values = React.useMemo(() => {
    if (!design) return {}
    const texts = design.vars.filter((v) => v.type === "text").length
    return sampleCardValues(design, identityDuration, {
      name: t("editor.preview.sampleName"),
      text: (n) =>
        texts > 1
          ? t("editor.preview.sampleTextNumbered", { n })
          : t("editor.preview.sampleText"),
    })
  }, [design, identityDuration, t])

  const front = design?.pages[0]
  const back = design?.pages[1]
  const showBack = flipped && Boolean(back)

  /* Form-only variables and files never reach the card, so without this their
     fake data would be invisible and they would look forgotten. */
  const unprinted = (design?.vars ?? []).filter(
    (v) => !design?.pages.some((p) => p.elements.some((e) => e.variable === v.name))
  )

  return (
    <>
      <DialogCloseButton />

      <DialogHeader>
        <DialogTitle>{t("editor.preview.title")}</DialogTitle>
        <DialogDescription>{t("editor.preview.description")}</DialogDescription>
      </DialogHeader>

      <DialogBody>
        {/* Full-bleed against the body's gutter, as on the printer's preview. */}
        <div className="-mx-5 flex flex-col items-center gap-4 border-y border-border-subtle bg-surface-sunken px-5 py-6">
          {front ? (
            <FlippingCard front={front} back={back} values={values} flipped={showBack} />
          ) : (
            <p className="py-10 text-center text-[13px] text-text-muted">
              {t("issue.noPreview")}
            </p>
          )}

          {back && (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-10 md:h-8"
                onClick={() => setFlipped(!showBack)}
              >
                <FlipHorizontal
                  data-icon="inline-start"
                  strokeWidth={1.75}
                  className={cn(
                    "transition-transform duration-500 motion-reduce:transition-none",
                    showBack && "-scale-x-100"
                  )}
                />
                {t("issue.flipCard")}
              </Button>
              <span className="text-xs font-medium text-text-muted">
                {showBack ? t("printer.back") : t("printer.front")}
              </span>
            </div>
          )}
        </div>

        {unprinted.length > 0 && (
          <div className="pt-4">
            <p className="text-xs font-medium text-text-secondary">
              {t("issue.groups.unprinted")}
            </p>
            <ul className="mt-1.5 flex flex-col gap-1 text-xs text-text-muted">
              {unprinted.map((v) => (
                <li key={v.name} className="flex justify-between gap-4">
                  <span className="min-w-0 truncate">{v.label}</span>
                  <span dir="auto" className="min-w-0 truncate font-mono text-[11px]">
                    {values[v.name]?.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <DialogClose
          render={
            <Button variant="outline" type="button" className="h-11 w-full md:h-9 md:w-auto">
              {t("common.close")}
            </Button>
          }
        />
      </DialogFooter>
    </>
  )
}

type CardFaceProps = React.ComponentProps<typeof CardFaceRender>

/**
 * Two faces back to back, sized by measuring: `CardFaceRender` takes a pixel
 * width because it scales the whole design from one transform.
 *
 * Bounded by height as well as width, because at this dialog's width a portrait
 * card would stand taller than the screen and push the flip button out of reach.
 */
function FlippingCard({
  front,
  back,
  values,
  flipped,
}: {
  front: CardFaceProps["page"]
  back: CardFaceProps["page"] | undefined
  values: CardFaceProps["values"]
  flipped: boolean
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(0)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(el.getBoundingClientRect().width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const ratio = front.width / front.height

  return (
    <div
      ref={ref}
      className="max-w-full"
      style={{ width: `min(100%, 460px, calc(52vh * ${ratio}))` }}
    >
      {width > 0 && (
        <div className="perspective-[1400px]" style={{ height: width / ratio }}>
          <div
            className={cn(
              "relative size-full transform-3d",
              "transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
              "motion-reduce:transition-none",
              flipped && "rotate-y-180"
            )}
          >
            <div className="absolute inset-0 backface-hidden">
              <CardFaceRender page={front} values={values} width={width} className={CARD_SHADOW} />
            </div>
            {back && (
              <div className="absolute inset-0 rotate-y-180 backface-hidden">
                <CardFaceRender page={back} values={values} width={width} className={CARD_SHADOW} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
