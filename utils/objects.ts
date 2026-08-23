/**
 * Flattens a nested object into `FormData` using PHP's bracket notation:
 * `{ address: { city: "Baghdad" }, files: [f] }` → `address[city]`, `files[0]`.
 *
 * `null` and `undefined` are skipped rather than sent as the strings "null" /
 * "undefined" — FormData stringifies everything it is given. Files, Blobs, and
 * Dates pass through as values.
 */
export function objectToFormData(
  data: Record<string, unknown>,
  formData: FormData = new FormData(),
  parentKey?: string,
): FormData {
  for (const [key, value] of Object.entries(data)) {
    const fieldKey = parentKey ? `${parentKey}[${key}]` : key
    appendValue(formData, fieldKey, value)
  }
  return formData
}

function appendValue(formData: FormData, key: string, value: unknown): void {
  if (value === null || value === undefined) return

  if (value instanceof File || value instanceof Blob) {
    formData.append(key, value)
    return
  }

  if (value instanceof Date) {
    formData.append(key, value.toISOString())
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => appendValue(formData, `${key}[${index}]`, entry))
    return
  }

  if (typeof value === "object") {
    objectToFormData(value as Record<string, unknown>, formData, key)
    return
  }

  // Booleans become "1"/"0": PHP reads the string "false" as truthy.
  if (typeof value === "boolean") {
    formData.append(key, value ? "1" : "0")
    return
  }

  formData.append(key, String(value))
}
