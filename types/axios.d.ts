/**
 * Module augmentation adding a custom `options` field to Axios configs.
 *
 * `options` is *not* a standard Axios field — it is how a caller tells the
 * interceptors in api/client.ts to deviate from the default key conversion.
 * See docs/network-layer.md §2.
 *
 * The `import type` line matters: without an import this file would be an
 * ambient module declaration that *replaces* the axios types instead of
 * extending them.
 */
import type { AxiosRequestConfig } from "axios"

/** Per-request escape hatches for the snake_case ⇄ camelCase interceptors. */
export type RequestOptions = {
  /** Send the body verbatim — for payloads already in snake_case. */
  skipRequestKeyConversion?: boolean
  /**
   * `true` returns the raw body. An object camelizes everything *except* the
   * named top-level properties, for fields holding free-form JSON whose keys
   * must survive untouched (e.g. `identity.request`).
   */
  skipResponseKeyConversion?: boolean | Record<string, boolean>
  /**
   * For FormData, convert only the root segment of a bracket path:
   * `joinData[0][fieldName]` → `join_data[0][fieldName]`.
   */
  preserveNestedFormDataKeys?: boolean
}

declare module "axios" {
  export interface AxiosRequestConfig {
    options?: RequestOptions
  }

  export interface InternalAxiosRequestConfig {
    options?: RequestOptions
  }
}

// Keeps `AxiosRequestConfig` referenced so the import is not elided.
export type { AxiosRequestConfig }
