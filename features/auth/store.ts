import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { User } from "@/features/users/types"
import { TEMP_TOKEN_KEY } from "@/utils/api/auth-helpers"

/**
 * Auth state + permission checks. See docs/authentication.md §4 and §6.
 *
 * This store is the source of truth for *UI* auth state only. The Axios layer
 * deliberately reads localStorage directly (`getAuthToken`) instead of
 * subscribing here, so it works in non-React code paths too — which is also
 * why the persist key must stay "auth": `getAuthToken` parses this exact entry.
 */

interface AuthState {
  user: User | null
  token: string | null
  isAuthed: boolean
  setAuth: (user: User, token: string) => void
  logout: () => void
  can: (permission: string, prefixed?: boolean) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthed: false,

      setAuth: (user, token) => set({ user, token, isAuthed: true }),

      logout: () => {
        if (typeof window !== "undefined") {
          // Must go, or it would shadow the next session's real token.
          window.localStorage.removeItem(TEMP_TOKEN_KEY)
        }
        set({ user: null, token: null, isAuthed: false })
      },

      /**
       * `can("members-list")` matches `admin-members-list`,
       * `organization-members-list` **or** `branch-members-list`. Pass
       * `prefixed: true` to match an exact name instead. Never throws; returns
       * false for a signed-out or role-less user.
       *
       * ### Why all three scopes, not two
       *
       * The unprefixed form used to try only `admin-` and `organization-`
       * (docs/CRUD-MIGRATION-REFERENCE.md §4.6), which made every gate a
       * branch user hit fail closed: their permissions are all named
       * `branch-*`, so a branch clerk with `branch-create-branch-user` saw no
       * Add button on the screen that grant exists for. `branch-` is included
       * here so a role's own scope is what decides, not the caller's spelling.
       */
      can: (permission, prefixed = false) => {
        const state = get()
        if (!state.isAuthed || !state.user) return false
        if (!state.user.roles || state.user.roles.length === 0) return false

        return state.user.roles.some((role) =>
          role.permissions?.some((perm) => {
            if (!prefixed) {
              return (
                perm.name === `admin-${permission}` ||
                perm.name === `organization-${permission}` ||
                perm.name === `branch-${permission}`
              )
            }
            return perm.name === permission
          })
        )
      },
    }),
    { name: "auth" }
  )
)
