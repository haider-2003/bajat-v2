import type { BaseEntity } from "@/types/api"

/** The tenant a user belongs to. */
export type Organization = BaseEntity & {
  id: number
  name: string
  logo?: string | null
}

/** A node in an organization's hierarchy. */
export type Branch = BaseEntity & {
  id: number
  name: string
  organizationId?: number
}
