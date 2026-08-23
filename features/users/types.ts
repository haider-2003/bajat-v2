import type { BaseEntity } from "@/types/api"
import type { Organization } from "@/features/organizations/types"
import type { Role } from "@/features/roles/types"

export type User = BaseEntity & {
  id: number
  name: string
  phone: string
  type: "admin" | "organization_user"
  /** Whether the user has already enrolled an authenticator app. */
  tfaEnabled: boolean
  isEnabled: boolean
  email?: string
  organization?: Organization
  roles?: Role[]
}
