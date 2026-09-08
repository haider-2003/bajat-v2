import type { RoleType } from "@/features/roles/types"
import type { TranslationKey } from "@/i18n/translate"

/**
 * The four strings that differ between the three role screens.
 *
 * `/role` is one endpoint serving admin, organization and branch roles alike
 * (features/roles/api.ts). The screens that edit them are identical but for the
 * `type` they force and the noun in their copy — so the components are shared
 * and parameterised by `scope`, and this is the copy that parameter selects.
 *
 * Written as literal `TranslationKey`s rather than built by interpolation so a
 * renamed dictionary entry is a compile error here, not a raw key in the UI.
 */
export const roleCopy: Record<
  RoleType,
  {
    metaTitle: TranslationKey
    countAfter: TranslationKey
    emptyHint: TranslationKey
    navLabel: TranslationKey
    section: TranslationKey
  }
> = {
  admin: {
    metaTitle: "roles.adminMetaTitle",
    countAfter: "roles.adminCountAfter",
    emptyHint: "roles.adminEmptyHint",
    navLabel: "nav.adminRoles",
    section: "nav.sections.management",
  },
  organization: {
    metaTitle: "roles.organizationMetaTitle",
    countAfter: "roles.organizationCountAfter",
    emptyHint: "roles.organizationEmptyHint",
    navLabel: "nav.organizationRoles",
    section: "nav.sections.administration",
  },
  branch: {
    metaTitle: "roles.branchMetaTitle",
    countAfter: "roles.branchCountAfter",
    emptyHint: "roles.branchEmptyHint",
    navLabel: "nav.branchRoles",
    section: "nav.sections.administration",
  },
}
