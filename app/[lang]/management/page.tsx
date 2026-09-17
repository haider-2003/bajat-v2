import { redirect } from "next/navigation"

import { localizeHref } from "@/i18n/href"
import { getLocale } from "@/i18n/server"

/**
 * A group header, not a screen. The expanded rail never links here — it
 * toggles the children — but the collapsed rail and a typed URL both do, and
 * landed on the 404. The first child is the answer either way.
 */
export default async function ManagementPage() {
  redirect(localizeHref("/management/admins", await getLocale()))
}
