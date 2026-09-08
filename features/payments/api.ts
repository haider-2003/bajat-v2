import { createApiFactory } from "@/utils/api/api-factory"
import type { Payment } from "./types"

/**
 * Payments. See docs/CRUD-MIGRATION-REFERENCE.md §1.13.
 *
 * Read-only: the factory generates the write hooks, and they are deliberately
 * not re-exported. `/payment` has no `POST`, `PUT` or `DELETE`, and an
 * exported hook reads as a supported one — the same reasoning as
 * `features/black-list`.
 */
const paymentsApi = createApiFactory<Payment>({
  entityName: "payment",
  endpoint: "/payment",
})

export const PaymentQueryKeys = paymentsApi.QueryKeys

export const useGetPayments = paymentsApi.useGetList
export const useGetPayment = paymentsApi.useGetById
