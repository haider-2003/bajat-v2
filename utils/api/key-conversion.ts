import { camelize, camelizeKeys, decamelize, decamelizeKeys } from "xcase"

import type { RequestOptions } from "@/types/axios"

/**
 * snake_case ⇄ camelCase conversion for request and response bodies.
 *
 * The wire format is snake_case; feature code is camelCase everywhere. These
 * two functions are the only place that boundary is crossed, and they run from
 * the interceptors in api/client.ts. See docs/network-layer.md §4.
 */

export type SkipResponseConfig = NonNullable<RequestOptions["skipResponseKeyConversion"]>

export const toSnakeCase = (key: string) => decamelize(key)
export const toCamelCase = (key: string) => camelize(key)

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Splits an object into converted keys and verbatim ones, then rejoins them. */
function camelizeExcept(
  value: unknown,
  skip: Record<string, boolean>,
): unknown {
  if (!isPlainObject(value)) return camelizeKeys(value)

  const converted: Record<string, unknown> = {}
  const preserved: Record<string, unknown> = {}

  for (const [key, entry] of Object.entries(value)) {
    // Match on the wire key *and* its camelized form, so a skip config written
    // in either casing works.
    if (skip[key] || skip[toCamelCase(key)]) {
      // The key itself is still normalized; only its *value* is left alone.
      preserved[toCamelCase(key)] = entry
    } else {
      converted[key] = entry
    }
  }

  return { ...camelizeKeys<Record<string, unknown>>(converted), ...preserved }
}

/** Everything in `source` except `key`, camelized. */
function camelizeSiblings(source: Record<string, unknown>, key: string) {
  const rest = { ...source }
  delete rest[key]
  return camelizeKeys<Record<string, unknown>>(rest)
}

/**
 * Camelizes a response body.
 *
 * - `skipConfig === true` → returned untouched.
 * - `skipConfig` object → everything camelized except the named properties,
 *   applied per row for a paginated `{ data: { data: [...] } }` envelope and
 *   to the entity itself for a single `{ data: {...} }` one.
 * - otherwise → a plain recursive camelize.
 */
export function transformResponseKeys<T = unknown>(
  data: unknown,
  skipConfig?: SkipResponseConfig,
): T {
  if (skipConfig === true) return data as T
  if (!skipConfig || typeof skipConfig !== "object") return camelizeKeys<T>(data)

  const skip = skipConfig

  if (isPlainObject(data) && isPlainObject(data.data)) {
    const inner = data.data

    // Paginated: skip per row, keep `meta` fully camelized.
    if (Array.isArray(inner.data)) {
      return {
        ...camelizeSiblings(data, "data"),
        data: {
          ...camelizeSiblings(inner, "data"),
          data: inner.data.map((row) => camelizeExcept(row, skip)),
        },
      } as T
    }

    // Single entity under `data`.
    return {
      ...camelizeSiblings(data, "data"),
      data: camelizeExcept(inner, skip),
    } as T
  }

  if (Array.isArray(data)) return data.map((row) => camelizeExcept(row, skip)) as T

  return camelizeExcept(data, skip) as T
}

/**
 * A bracket-notation FormData key mixes a backend field name with app-owned
 * nested keys, so only the root segment may be converted:
 * `joinData[0][fieldName]` → `join_data[0][fieldName]`.
 */
export function convertFormDataKeyRootOnly(key: string): string {
  const bracketIndex = key.indexOf("[")
  if (bracketIndex === -1) return toSnakeCase(key)
  return toSnakeCase(key.substring(0, bracketIndex)) + key.substring(bracketIndex)
}

export type TransformRequestOptions = {
  skipConversion?: boolean
  preserveNestedFormDataKeys?: boolean
}

/**
 * Decamelizes a request body.
 *
 * FormData cannot be mutated key-by-key in place without reordering surprises,
 * so a fresh instance is built. Files and Blobs pass through as values.
 */
export function transformRequestKeys(
  data: unknown,
  options?: TransformRequestOptions,
): unknown {
  if (options?.skipConversion) return data

  if (typeof FormData !== "undefined" && data instanceof FormData) {
    const converted = new FormData()
    data.forEach((value, key) => {
      const nextKey = options?.preserveNestedFormDataKeys
        ? convertFormDataKeyRootOnly(key)
        : toSnakeCase(key)
      converted.append(nextKey, value)
    })
    return converted
  }

  // Strings (a pre-serialized body), URLSearchParams, Blobs: nothing to convert.
  if (isPlainObject(data) || Array.isArray(data)) return decamelizeKeys(data)

  return data
}
