"use client"

import * as React from "react"
import { Check, Download, Link2 } from "lucide-react"

import { RowActions, type RowActionItem } from "@/components/table/row-actions"
import type { TemplateExport } from "@/features/templates/types"
import { useT } from "@/i18n/context"
import { formatText } from "@/utils/format"

/**
 * What can be done with one export — docs/IDS-FLOW-EXPORTS-ROUTES.md §4.3.
 *
 * ### No request, no token, no proxy
 *
 * Download is `window.open(file)`: a plain browser navigation to the storage
 * URL. The bearer token does not travel, so the URL has to be anonymously
 * fetchable — a public bucket or a pre-signed link — which is the server's
 * contract, not something the client can add to (spec §9.10). The image
 * proxy is no help either: it passes images and this is a ZIP.
 *
 * Copy puts the same URL on the clipboard, for handing the file to someone
 * who is not signed in.
 *
 * ### Disabled until there is a file
 *
 * `file` is the one field the screen decides on. Empty means the job has
 * not finished — or has failed, which the status badge beside it says when
 * the server does. The primary stays visible and disabled rather than
 * vanishing: "not ready" is the answer, and a row with no button reads as a
 * row with nothing to give.
 *
 * ### Read-only, deliberately
 *
 * There is no retry, cancel, rename or delete on this resource (§4.5); the
 * menu holds Copy and nothing else.
 */
export function ExportActions({
  row,
  className,
}: {
  row: TemplateExport
  className?: string
}) {
  const t = useT()
  const file = row.file?.trim() || null
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(id)
  }, [copied])

  const copy = async () => {
    if (!file) return
    try {
      await navigator.clipboard.writeText(file)
      setCopied(true)
    } catch {
      // Clipboard denied (an insecure origin, or a refused prompt). Download
      // still works, and the URL is in the record sheet to select by hand.
    }
  }

  const items: RowActionItem[] = [
    {
      key: "copy",
      label: copied ? t("common.copied") : t("exports.copyLink"),
      icon: copied ? Check : Link2,
      disabled: !file,
      onSelect: copy,
    },
  ]

  return (
    <RowActions
      label={t("exports.exportOf", { template: formatText(row.template?.title) })}
      primary={{
        label: file ? t("exports.download") : t("exports.notReady"),
        icon: Download,
        disabled: !file,
        onSelect: () => {
          if (file) window.open(file, "_blank", "noopener,noreferrer")
        },
      }}
      items={items}
      className={className}
    />
  )
}
