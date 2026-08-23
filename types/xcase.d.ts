/**
 * xcase ships no types. Only the four helpers key-conversion.ts uses are
 * declared here; the package's runtime surface is larger.
 */
declare module "xcase" {
  export function camelize(input: string): string
  export function decamelize(input: string, separator?: string): string
  export function camelizeKeys<T = unknown>(input: unknown): T
  export function decamelizeKeys<T = unknown>(input: unknown, separator?: string): T
}
