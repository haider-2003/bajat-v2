# The Network Layer, Piece by Piece

How every request in the Bajat dashboard is built, sent, answered, cached and refreshed: the Axios client, its interceptors, the custom `options` field, auth tokens, key conversion, FormData, the shared types, query strings, pagination, the API factory, React Query, every feature's API module, how screens use them, errors, and images.

> **What this file is.** A snapshot of the code at commit `f0a8238` (2026-10-25). Every block headed "full file" is the real file, pasted in whole, comments included. Blocks headed "excerpt" or "example" are trimmed or written for this guide. If the code and this file disagree, the code is right, so update this file.
>
> [docs/network-layer.md](docs/network-layer.md) is an older version of this guide, and parts of it no longer match the code. [§20](#20-where-docsnetwork-layermd-is-out-of-date) lists the differences.

---

## Contents

1. [The map: every file involved](#1-the-map-every-file-involved)
2. [Life of a request: a full trace](#2-life-of-a-request-a-full-trace)
3. [The Axios client: `api/client.ts`](#3-the-axios-client-apiclientts)
4. [The custom `options` field: `types/axios.d.ts`](#4-the-custom-options-field-typesaxiosdts)
5. [Tokens and 401: `utils/api/auth-helpers.ts` and the auth feature](#5-tokens-and-401-utilsapiauth-helpersts-and-the-auth-feature)
6. [snake_case ⇄ camelCase: `utils/api/key-conversion.ts`](#6-snake_case--camelcase-utilsapikey-conversionts)
7. [Multipart bodies: `utils/objects.ts`](#7-multipart-bodies-utilsobjectsts)
8. [Shared types: `types/api.ts`](#8-shared-types-typesapits)
9. [Query strings: `serializeQuery` and `buildFilter`](#9-query-strings-serializequery-and-buildfilter)
10. [Pagination: `readPageInfo`](#10-pagination-readpageinfo)
11. [The API factory: `utils/api/api-factory.ts`](#11-the-api-factory-utilsapiapi-factoryts)
12. [React Query: `providers/react-query-provider.tsx`](#12-react-query-providersreact-query-providertsx)
13. [Feature API modules: the three patterns](#13-feature-api-modules-the-three-patterns)
14. [Every endpoint, every hook](#14-every-endpoint-every-hook)
15. [Using it from a screen](#15-using-it-from-a-screen)
16. [Errors in detail](#16-errors-in-detail)
17. [Images and files](#17-images-and-files)
18. [Recipes](#18-recipes)
19. [Gotchas checklist](#19-gotchas-checklist)
20. [Where docs/network-layer.md is out of date](#20-where-docsnetwork-layermd-is-out-of-date)
21. [Appendix: the remaining feature modules, in full](#appendix-the-remaining-feature-modules-in-full)

---

## 1. The map: every file involved

### The core: shared by every request

| File | What it is | Section |
| --- | --- | --- |
| [api/client.ts](api/client.ts) | The single Axios instance: base URL, default headers, request and response interceptors | [§3](#3-the-axios-client-apiclientts) |
| [types/axios.d.ts](types/axios.d.ts) | Adds a custom `options` field to Axios's config type | [§4](#4-the-custom-options-field-typesaxiosdts) |
| [utils/api/auth-helpers.ts](utils/api/auth-helpers.ts) | Reads the token from `localStorage`, adds `Authorization`, handles 401 | [§5](#5-tokens-and-401-utilsapiauth-helpersts-and-the-auth-feature) |
| [utils/api/key-conversion.ts](utils/api/key-conversion.ts) | Converts camelCase ⇄ snake_case for bodies, with escape hatches | [§6](#6-snake_case--camelcase-utilsapikey-conversionts) |
| [utils/objects.ts](utils/objects.ts) | `objectToFormData`: nested object → PHP bracket-notation `FormData` | [§7](#7-multipart-bodies-utilsobjectsts) |
| [types/api.ts](types/api.ts) | `BaseEntity`, `BaseQuery`, `FilterQuery`, `GetResponse`, `PaginationMeta`, `ApiErrorBody`… | [§8](#8-shared-types-typesapits) |
| [types/xcase.d.ts](types/xcase.d.ts) | Type declarations for the `xcase` package (it ships none) | [§6](#6-snake_case--camelcase-utilsapikey-conversionts) |
| [utils/api/api.ts](utils/api/api.ts) | `serializeQuery`: `BaseQuery` → URL params | [§9](#9-query-strings-serializequery-and-buildfilter) |
| [utils/api/filters.ts](utils/api/filters.ts) | `buildFilter`: a record of filter values → a sorted `FilterQuery[]` | [§9](#9-query-strings-serializequery-and-buildfilter) |
| [utils/api/pagination.ts](utils/api/pagination.ts) | `readPageInfo`: reads total, page and last page from either list envelope | [§10](#10-pagination-readpageinfo) |
| [utils/api/api-factory.ts](utils/api/api-factory.ts) | `createApiFactory`: builds the five CRUD hooks and the query keys for one REST resource | [§11](#11-the-api-factory-utilsapiapi-factoryts) |
| [providers/react-query-provider.tsx](providers/react-query-provider.tsx) | The `QueryClient`: stale time, retry policy, backoff, devtools | [§12](#12-react-query-providersreact-query-providertsx) |

### Per feature

| File | What it is | Section |
| --- | --- | --- |
| `features/<feature>/api.ts` | The hooks a screen imports: a factory instance plus hand-written extras | [§13](#13-feature-api-modules-the-three-patterns), [§14](#14-every-endpoint-every-hook) |
| `features/<feature>/types.ts` | The entity shape (camelCase) and its `Create…Input` / `Update…Input` | [§13](#13-feature-api-modules-the-three-patterns) |

### Around the edges

| File | What it is | Section |
| --- | --- | --- |
| [hooks/use-list-query.ts](hooks/use-list-query.ts) | Page and page-size state for a list screen, tied to its filters | [§15](#15-using-it-from-a-screen) |
| [hooks/use-debounce.ts](hooks/use-debounce.ts) | Waits until typing stops before a value reaches a query key | [§15](#15-using-it-from-a-screen) |
| [hooks/use-sticky-state.ts](hooks/use-sticky-state.ts) | `useState` backed by `sessionStorage`, so filters survive navigation | [§15](#15-using-it-from-a-screen) |
| [hooks/use-online.ts](hooks/use-online.ts) | `navigator.onLine`, as a hook | [§16](#16-errors-in-detail) |
| [utils/download-image.ts](utils/download-image.ts) | `displayImageSrc`, `downloadImage`: route storage images through our proxy | [§17](#17-images-and-files) |
| [app/api/download-image/route.ts](app/api/download-image/route.ts) | The same-origin image proxy (a Next.js route handler) | [§17](#17-images-and-files) |
| [proxy.ts](proxy.ts) | Locale redirects. It never touches API traffic, but it shapes the 401 redirect | [§5](#5-tokens-and-401-utilsapiauth-helpersts-and-the-auth-feature) |
| [.env.example](.env.example) | `NEXT_PUBLIC_API_BASE_URL` | [§3](#3-the-axios-client-apiclientts) |

### Libraries

| Package | Version | Used for |
| --- | --- | --- |
| `axios` | 1.19.0 | HTTP: one shared instance with interceptors |
| `@tanstack/react-query` | 5.102.1 | Server state: caching, deduping, retries, invalidation |
| `@tanstack/react-query-devtools` | 5.102.1 | The cache inspector, shown only in development |
| `xcase` | 2.0.1 | `camelize`, `decamelize`, `camelizeKeys`, `decamelizeKeys` |
| `zustand` | 5.0.15 | The persisted `auth` store whose `localStorage` entry holds the session token |

### The layers

```
 Component  (app/[lang]/…/components/*.tsx)
    │   const q = useGetMembers(query)          const m = useCreateMember()
    │   rows = q.data?.data.data                m.mutate({ name, phone, organizationIds })
    ▼
 features/<feature>/api.ts                      ← names the hooks, adds custom endpoints
    │
    ▼
 utils/api/api-factory.ts                       ← useGetList / useGetById / useCreate / useUpdate / useDelete
    │   serializeQuery()   utils/api/api.ts       (params)
    │   objectToFormData() utils/objects.ts       (multipart bodies)
    ▼
 @tanstack/react-query                          ← cache keyed by QueryKeys, dedupe, retry, invalidation
    │   runs queryFn / mutationFn
    ▼
 api/client.ts  (the one Axios instance)
    │   request interceptor   body camel → snake · params camel → snake · Authorization: Bearer <token>
    │   response interceptor  body snake → camel · 401 → clear storage + hard redirect to /<lang>/login
    ▼
 https://api.bajat.net/api/dashboard/v1/…       (or NEXT_PUBLIC_API_BASE_URL)
```

Three rules follow from this, and the rest of this guide explains them:

1. **Screens import hooks, not `api`.** A screen imports `useGetMembers` from `features/members/api.ts`, never Axios. `api` is imported directly only inside `features/*/api.ts`, for endpoints the factory does not cover.
2. **App code is always camelCase.** The server speaks snake_case. Only the interceptors cross that boundary. Error bodies are the one exception ([§6](#6-snake_case--camelcase-utilsapikey-conversionts)).
3. **Writes refresh reads by themselves.** Every factory mutation invalidates its whole resource, so a screen never refetches by hand.

---

## 2. Life of a request: a full trace

The best way to see how the pieces fit is to follow one real request from a keystroke to rendered rows. The screen is App Users ([app/[lang]/members/components/members-client.tsx](app/[lang]/members/components/members-client.tsx)). The user has typed `ali` in the search box, picked organizations 22 and 23, and clicks page 2.

### Step 1: screen state becomes a filter

```ts
// excerpt — members-client.tsx
const search = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS)   // "ali", 300 ms after the last keystroke
const phone = useDebounce(phoneDigits(phoneQuery), SEARCH_DEBOUNCE_MS) // ""

const filter = React.useMemo(
  () =>
    buildFilter({
      search,                // "ali"
      phone,                 // ""            → dropped (empty means absent)
      organizationIds,       // ["22", "23"]
      createdAtRange: createdAt ? [toInstant(createdAt)] : undefined, // undefined → dropped
    }),
  [search, phone, organizationIds, createdAt]
)
```

`buildFilter` ([§9](#9-query-strings-serializequery-and-buildfilter)) drops the empty values and sorts the rest by field name:

```ts
[
  { field: "organizationIds", value: ["22", "23"] },
  { field: "search", value: "ali" },
]
```

### Step 2: the filter becomes a `BaseQuery`

```ts
const { query: listQuery, page, pageSize, setPage, setPageSize } =
  useListQuery(filter, { pageSize: DEFAULT_PAGE_SIZE, storageKey: LIST_KEY })
// the click on "2" called setPage(2), so:
// listQuery = { page: 2, pageSize: 10, filter: [ …the two clauses… ] }
```

### Step 3: the hook becomes a React Query query

```ts
const membersQuery = useGetMembers(listQuery, { placeholderData: keepPreviousData })
```

`useGetMembers` is the factory's `useGetList` ([§11](#11-the-api-factory-utilsapiapi-factoryts)). It calls `useQuery` with:

```ts
queryKey: ["member", { page: 2, pageSize: 10, filter: [ … ] }]
```

React Query hashes that key. If an entry exists and is younger than `staleTime` (60 s, [§12](#12-react-query-providersreact-query-providertsx)), it is returned with no request. Here it is a new page, so `queryFn` runs. While it runs, `keepPreviousData` keeps page 1's rows on screen, so the table does not go blank.

### Step 4: `serializeQuery` flattens the query

```ts
serializeQuery(listQuery)
// → { page: 2, per_page: 10, organizationIds: ["22", "23"], search: "ali" }
```

### Step 5: Axios is called, and the request interceptor runs

```ts
api.get("/member", { params: { page: 2, per_page: 10, organizationIds: [...], search: "ali" }, options: {...} })
```

The request interceptor in [api/client.ts](api/client.ts):

1. `config.data` is empty (a GET has no body), so body conversion is skipped.
2. `config.params` is decamelized: `organizationIds` → `organization_ids`. `per_page` is already snake_case and stays as it is.
3. `addAuthorizationHeader` reads the token from `localStorage` and sets `Authorization: Bearer eyJ…`.

### Step 6: Axios builds the URL and sends it

Axios joins `baseURL` and the path. The leading `/` on `/member` is dropped, so it does not replace the base path. Array params get `[]`. The URL below is the real output of `axios.getUri` with this config:

```
GET https://api.bajat.net/api/dashboard/v1/member?page=2&per_page=10&organization_ids%5B%5D=22&organization_ids%5B%5D=23&search=ali
Accept: application/json
Authorization: Bearer eyJ…
```

(`%5B%5D` is `[]`. The server reads `organization_ids[]=22&organization_ids[]=23` as an array. Axios drops `Content-Type` because a GET has no body.)

### Step 7: the server answers in snake_case

```json
{
  "data": [
    { "id": 7, "name": "Ali Hassan", "phone": "9647701234567", "created_at": "2026-09-01T10:00:00Z",
      "organizations": [{ "id": 22, "name": "Baghdad Uni" }] }
  ],
  "meta": { "current_page": 2, "per_page": 10, "total": 42 }
}
```

### Step 8: the response interceptor camelizes it

Axios has already parsed the JSON. The interceptor sees a body, not a blob, so it runs `transformResponseKeys(body, undefined)`. That is a plain recursive camelize:

```ts
{
  data: [{ id: 7, name: "Ali Hassan", phone: "9647701234567", createdAt: "2026-09-01T10:00:00Z",
           organizations: [{ id: 22, name: "Baghdad Uni" }] }],
  meta: { currentPage: 2, perPage: 10, total: 42 },
}
```

### Step 9: the screen reads it

`useGetList` returns the **whole Axios response**, so the body is one `data` deeper than you might expect:

```ts
membersQuery.data            // AxiosResponse: { data, status, headers, config, … }
membersQuery.data.data       // the body:      { data: rows, meta }
membersQuery.data.data.data  // the rows:      Member[]

readPageInfo(membersQuery.data?.data)
// → { total: 42, perPage: 10, lastPage: 5, currentPage: 2 }
```

### And a write: the user adds a member

```ts
createMember.mutate({ name: "Sara", phone: "9647709876543", organizationIds: ["22"] })
```

1. The factory's `useCreate` → `buildRequestBody` sends JSON, because `/member` is not a FormData resource.
2. `api.post("/member", body)`. The request interceptor decamelizes the body to `{ "name": "Sara", "phone": "9647709876543", "organization_ids": ["22"] }` and adds the token.
3. The server answers `201` with the new member, often wrapped as `{ "data": { … } }`.
4. The response interceptor camelizes it, and `unwrapEntity` removes the `data` wrapper.
5. `onSuccess` calls `queryClient.invalidateQueries({ queryKey: ["member"] })`. Every member query is marked stale: all list pages, the header count, any open detail. The ones on screen refetch right away.
6. The `onSuccess` the screen passed in (`onCreated`) runs after that.

### And a failure: the server rejects it

The server answers `422`:

```json
{ "message": "The organization ids field is required.", "errors": { "organization_ids": ["The organization ids field is required."] } }
```

1. The response interceptor's error branch runs. The status is not 401, so it only re-rejects.
2. **The body is not camelized.** Error bodies skip the success handler, so `errors` is keyed by wire names like `organization_ids`.
3. The mutation's `onError` gets the `AxiosError`. The dialog maps `organization_ids` back to its `organizationIds` field ([§15](#15-using-it-from-a-screen)).

---

## 3. The Axios client: `api/client.ts`

`api/client.ts` — full file:

```ts
import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios"
import { decamelizeKeys } from "xcase"

import { addAuthorizationHeader, handleUnauthorizedResponse } from "@/utils/api/auth-helpers"
import { transformRequestKeys, transformResponseKeys } from "@/utils/api/key-conversion"

/**
 * The single shared Axios instance. Everything the app sends goes through here.
 * See docs/network-layer.md §2.
 *
 * Components do not import this for normal CRUD — they import hooks from
 * `features/<feature>/api.ts`, which sit on top of the API factory. Reach for
 * `api` directly only for non-REST endpoints, binaries, and public calls.
 */

/** Production dashboard API — the default, and what the Vercel build talks to. */
export const PROD_API_BASE_URL = "https://api.bajat.net/api/dashboard/v1/"

/**
 * UAT dashboard API. Not used by default; point a build at it through
 * `NEXT_PUBLIC_API_BASE_URL` (see .env.example).
 */
export const UAT_API_BASE_URL = "https://identities.g4t.io/api/dashboard/v1/"

/**
 * Overridable so staging/local backends do not need a code change. The default
 * is the production dashboard API.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so a key that exists but is
 * blank in the build environment inlines as `""`, and `??` would pass that
 * straight through. Axios treats a falsy `baseURL` as "no base" and leaves the
 * relative endpoint path untouched, so the browser resolves it against the
 * current page — `auth/send_otp` posts to `/<lang>/auth/send_otp` on our own
 * origin instead of the API. Blank has to count as unset.
 */
const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()

export const API_BASE_URL = configuredApiBaseUrl || PROD_API_BASE_URL

const baseConfig: AxiosRequestConfig = {
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
}

const api: AxiosInstance = axios.create(baseConfig)

// ─── Request ────────────────────────────────────────────────────────────────
// camelCase → snake_case on the body and the query string, then the token.
api.interceptors.request.use((config) => {
  if (config.data) {
    config.data = transformRequestKeys(config.data, {
      skipConversion: config.options?.skipRequestKeyConversion,
      preserveNestedFormDataKeys: config.options?.preserveNestedFormDataKeys,
    })
  }

  if (config.params) {
    config.params = decamelizeKeys(config.params)
  }

  return addAuthorizationHeader(config)
})

// ─── Response ───────────────────────────────────────────────────────────────
// snake_case → camelCase, and a global 401 → logout.
api.interceptors.response.use(
  (response) => {
    // Never rewrite bytes: a blob or arraybuffer is a file, not a JSON body.
    const isBinaryResponse =
      response.config.responseType === "blob" ||
      response.config.responseType === "arraybuffer"

    if (!isBinaryResponse) {
      response.data = transformResponseKeys(
        response.data,
        response.config.options?.skipResponseKeyConversion,
      )
    }

    return response
  },
  (error) => {
    // 401 is handled once, here — feature code never handles it.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      handleUnauthorizedResponse()
    }
    return Promise.reject(error)
  },
)

export default api
```

### 3.1 The base URL

| Constant | Value | Used when |
| --- | --- | --- |
| `PROD_API_BASE_URL` | `https://api.bajat.net/api/dashboard/v1/` | Default. The Vercel build talks to this |
| `UAT_API_BASE_URL` | `https://identities.g4t.io/api/dashboard/v1/` | Never by default. It is exported so you can copy it into `.env.local` |
| `API_BASE_URL` | `NEXT_PUBLIC_API_BASE_URL` trimmed, or `PROD_API_BASE_URL` | What `baseURL` is set to |

To point a local build at UAT, copy [.env.example](.env.example) to `.env.local` and uncomment the UAT line:

```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL=https://identities.g4t.io/api/dashboard/v1/
```

Things that matter here:

- **`NEXT_PUBLIC_*` is inlined at build time.** Changing it needs a restart of `next dev` or a new build, not a page reload.
- **`||`, not `??`.** A variable that is set but blank comes through as `""`. `??` would keep that `""`, and Axios treats an empty `baseURL` as "no base". The request would then go to your own site (`/en/auth/send_otp`) instead of the API. `||` treats blank as unset.
- **How paths are joined.** Axios removes the trailing `/` from the base and the leading `/` from the path, then joins them with one `/`. So `"/member"` and `"member"` both give `…/v1/member`. A leading slash does **not** jump to the root of the host.
- **Absolute URLs skip `baseURL`.** `api.get("https://other.host/x")` goes to `https://other.host/x`, but it **still runs both interceptors, so the bearer token is attached.** Only use `api` for Bajat hosts.

### 3.2 Default headers

`Content-Type: application/json` and `Accept: application/json` go on every request. Two cases change that:

- A GET or DELETE with no body: Axios drops `Content-Type`.
- A `FormData` body: in the browser, Axios drops `Content-Type` so the browser can write `multipart/form-data; boundary=…` itself. The `"multipart/form-data"` headers the code passes for FormData are a statement of intent. They are not what the server finally sees.

### 3.3 The request interceptor

It runs on every request, **before** Axios serializes anything, so `config.data` is still the JavaScript object or `FormData` you passed.

| Step | Code | What happens |
| --- | --- | --- |
| 1 | `if (config.data) config.data = transformRequestKeys(…)` | Body keys camel → snake ([§6](#6-snake_case--camelcase-utilsapikey-conversionts)). Skipped when `options.skipRequestKeyConversion` is set. For FormData, `options.preserveNestedFormDataKeys` converts only the root of each key |
| 2 | `if (config.params) config.params = decamelizeKeys(config.params)` | Query-string keys camel → snake. **There is no opt-out**: params are always converted |
| 3 | `return addAuthorizationHeader(config)` | `Authorization: Bearer <token>` if a token exists ([§5](#5-tokens-and-401-utilsapiauth-helpersts-and-the-auth-feature)) |

After the interceptor, Axios's own `transformRequest` turns a plain object into a JSON string. `FormData` is sent as it is.

### 3.4 The response interceptor: success branch

It runs **after** Axios has parsed the JSON, so `response.data` is already an object.

- If `responseType` is `"blob"` or `"arraybuffer"`, the body is a file and is left alone.
- Otherwise `transformResponseKeys(response.data, response.config.options?.skipResponseKeyConversion)` camelizes it, honouring the skip setting ([§6](#6-snake_case--camelcase-utilsapikey-conversionts)).
- It returns the **whole** `AxiosResponse`. Whether a hook returns `response` or `response.data` is up to each hook.

### 3.5 The response interceptor: error branch

- `401` calls `handleUnauthorizedResponse()`, which clears storage and does a hard redirect to login ([§5](#5-tokens-and-401-utilsapiauth-helpersts-and-the-auth-feature)).
- **Every** error is still rejected, 401 included. React Query sees the failure, and any `onError` still runs.
- **Nothing is camelized here.** `error.response.data` keeps the server's snake_case keys. That is why `AuthErrorBody.require_recaptcha` and the `errors` keys are snake_case ([§16](#16-errors-in-detail)).

### 3.6 When to import `api` directly

Only inside a `features/*/api.ts` file, and only for:

- endpoints that are not plain CRUD (`/identity/approve`, `/user/{id}/reset`, `/template/clone`);
- resources with no id (`/webhook`, `/statistics`);
- auth (`/auth/*`);
- binary downloads (with `responseType`).

---

## 4. The custom `options` field: `types/axios.d.ts`

`types/axios.d.ts` — full file:

```ts
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
```

Axios has no `options` config field. This file **augments** Axios's own `AxiosRequestConfig` and `InternalAxiosRequestConfig` interfaces, so this type-checks:

```ts
api.post("/identity", body, { options: { skipRequestKeyConversion: true } })
```

…and so the interceptors can read `config.options?.…` with no cast. Axios passes unknown config fields through to the interceptors untouched.

Why the `import type` line matters: a `.d.ts` with no import or export is an *ambient* declaration. `declare module "axios"` in such a file would **replace** the axios types instead of adding to them. The import turns the file into a module, so the `declare module` block merges into the real types.

| Option | Read by | Effect |
| --- | --- | --- |
| `skipRequestKeyConversion: true` | request interceptor | The body is sent exactly as written. Use it when the keys are already snake_case or are data the server must get verbatim (template variable names on `/identity`) |
| `skipResponseKeyConversion: true` | response interceptor | The body comes back raw, still snake_case |
| `skipResponseKeyConversion: { request: true }` | response interceptor | Everything is camelized **except the value** of the named top-level property of each row. The key itself is still camelized |
| `preserveNestedFormDataKeys: true` | request interceptor | For FormData, only the part of each key before the first `[` is converted: `joinData[0][fieldName]` → `join_data[0][fieldName]` |

Where it is set:

- **Through the factory:** `createApiFactory({ disableRequestKeyConversion, skipResponseKeyConversion, preserveNestedFormDataKeys })` builds one `requestOptions` object and passes it on every request it makes ([§11](#11-the-api-factory-utilsapiapi-factoryts)).
- **By hand:** a custom hook passes `{ options: … }` itself. [features/ids/api.ts](features/ids/api.ts) defines `REQUEST_OPTIONS` once so its custom calls behave like its factory calls.

---

## 5. Tokens and 401: `utils/api/auth-helpers.ts` and the auth feature

`utils/api/auth-helpers.ts` — full file:

```ts
import type { InternalAxiosRequestConfig } from "axios"

import { defaultLocale, isLocale } from "@/i18n/config"

/**
 * Token read and 401 handling for the Axios interceptors.
 *
 * The token is read from `localStorage` on *every* request rather than from
 * React state, so non-component code (interceptors, plain fetch helpers) can
 * authenticate too. See docs/authentication.md §2.
 */

/** Short-lived token issued by `POST /auth/login`, valid only for `/auth/2fa/*`. */
export const TEMP_TOKEN_KEY = "temp_token"

/** The persisted auth store — written by zustand's `persist({ name: "auth" })`. */
export const AUTH_STORAGE_KEY = "auth"

/** The shape zustand's persist middleware writes. */
type PersistedAuth = {
  state?: { token?: string | null }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null // SSR-safe: no localStorage on the server

  // The temp token wins while it exists — it is what authorizes the
  // half-authenticated TOTP calls. It MUST be cleared on success, or every
  // later request would keep sending it instead of the real access token.
  const tempToken = window.localStorage.getItem(TEMP_TOKEN_KEY)
  if (tempToken) return tempToken

  const authStorage = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!authStorage) return null

  try {
    const { state } = JSON.parse(authStorage) as PersistedAuth
    return state?.token ?? null
  } catch {
    // Corrupted entry — treat as signed out rather than throwing inside an
    // interceptor, where the error would surface as an opaque request failure.
    return null
  }
}

export function addAuthorizationHeader(config: InternalAxiosRequestConfig) {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}

export function clearAuthStorage(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  window.localStorage.removeItem(TEMP_TOKEN_KEY)
}

/**
 * Global 401 handler. Feature code never handles 401 itself.
 *
 * A hard redirect (not `router.push`) is deliberate: it tears down every
 * in-memory cache and store, so no stale authenticated state survives.
 */
export function handleUnauthorizedResponse(): void {
  if (typeof window === "undefined") return

  // No token means nobody was signed in, so a 401 is just an unauthenticated
  // call — there is no session to tear down, and bouncing would strand anyone
  // on a public page (or loop on /login itself).
  const hadToken = getAuthToken() !== null
  clearAuthStorage()
  if (!hadToken) return

  // Every route lives under `app/[lang]`, so the sign-in page is `/en/login`
  // — never a bare `/login`. Comparing against the unprefixed path meant the
  // guard never matched: a 401 raised *on the login page* bounced anyway, to a
  // URL the proxy then had to redirect again. Two full page loads, each one
  // re-running the intro splash.
  const currentLocale = window.location.pathname.split("/")[1]
  const locale = isLocale(currentLocale) ? currentLocale : defaultLocale
  const loginPath = `/${locale}/login`

  if (window.location.pathname !== loginPath) {
    // A full page load is the point: router.push() would keep the React tree
    // alive, and with it every cached query belonging to the signed-out user.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = loginPath
  }
}
```

### 5.1 Where tokens live

| `localStorage` key | Holds | Written by | Read by | Cleared by |
| --- | --- | --- | --- | --- |
| `temp_token` | A short-lived token that authorizes only `/auth/2fa/*` | [login-form.tsx](app/[lang]/login/login-form.tsx) after `POST /auth/login` succeeds | `getAuthToken` (it is checked first) | login-form after `POST /auth/2fa/enable` succeeds; `useAuthStore.logout()`; `clearAuthStorage()` |
| `auth` | zustand's persisted store: `{"state":{"user":…,"token":"…","isAuthed":true},"version":0}` | `useAuthStore.setAuth()` through `persist({ name: "auth" })` | `getAuthToken` parses `state.token` | `clearAuthStorage()` on a 401; `logout()` resets it to `token: null` |

`getAuthToken` reads `localStorage` on **every** request instead of subscribing to the zustand store. That way it works in code outside React (the interceptors), and a token written a moment ago is used on the very next request.

Precedence: **`temp_token` wins if it is there.** That is how the half-signed-in 2FA calls are authorized without any special code. It is also why the temp token **must** be removed once the real token arrives. Otherwise every later request would keep sending the temp token, and the real session would never be used.

### 5.2 `handleUnauthorizedResponse`, step by step

1. On the server (`window` undefined) it does nothing.
2. `hadToken`: was anyone signed in? It checks this **before** clearing.
3. `clearAuthStorage()` removes both `auth` and `temp_token`.
4. If there was no token, it stops there. A 401 on a public call is not a session ending, and redirecting would trap a user who is already on the login page.
5. It works out the locale from the first path segment (`/ar/members` → `ar`), falling back to `defaultLocale`. Every route lives under `app/[lang]`, so the login page is `/ar/login`, never `/login`.
6. If the user is not already on that page: `window.location.href = loginPath`. This is a **full page load**, on purpose. `router.push` would keep the React tree and the React Query cache alive, along with the signed-out user's data.

Why the locale matters: [proxy.ts](proxy.ts) redirects any path without a locale (`/login` → `/en/login`). Sending the user to `/login` directly would cost two full page loads, each one replaying the intro splash.

### 5.3 The sign-in sequence on the wire

| # | Hook ([features/auth/api.ts](features/auth/api.ts)) | Request | Token sent | Response (after camelize) | What the client does next |
| --- | --- | --- | --- | --- | --- |
| 0 | `useRecaptchaCheck` | `GET /auth/recaptcha_check` | none | `{ recaptchaRequired }` | Shows a captcha if it is needed. Cached forever, never retried |
| 1 | `useSendOTP` | `POST /auth/send_otp` `{ phone }` | none | empty | `429` means the resend was rate-limited |
| 2 | `useLogin` | `POST /auth/login` `{ phone, otp, captcha_token }` | none | `{ tempToken, user }` | `localStorage.setItem("temp_token", …)`, then goes to the authenticator step |
| 3 | `use2FASetup(enabled)` | `GET /auth/2fa/setup` (only when `user.tfaEnabled === false`) | **temp** | `{ secret, qrCode }` (raw SVG) | `qrCodeSrc(svg)` → an `<img>` data URL. The cache entry is removed when the screen closes |
| 4 | `use2FAEnable` | `POST /auth/2fa/enable` `{ otp }` | **temp** | `{ accessToken, user }` | Removes `temp_token` **first**, then `setAuth(user, accessToken)`, then `router.push("/")` |
| 5 | (every hook) | anything | **access** | — | — |
| — | `useLogout` | `POST /auth/logout` | access | empty | `logout()` and `router.push("/login")`, called from both `onSuccess` and `onError` |

`LoginInput.captchaToken` goes out as `captcha_token`, because the body is decamelized like any other.

`features/auth/api.ts` — full file:

```ts
import { useMutation, useQuery } from "@tanstack/react-query"
import { isAxiosError } from "axios"

import api from "@/api/client"
import type {
  AuthErrorBody,
  LoginInput,
  LoginResponse,
  OTPInput,
  RecaptchaCheckResponse,
  TotpVerifyInput,
  TwoFactorSetupResponse,
} from "./types"

/**
 * Auth endpoints. See docs/authentication.md §3.
 *
 * These are not a REST resource, so they skip `createApiFactory` and sit
 * directly on the shared Axios instance as plain React Query hooks.
 */

/** Step 1 — sends the SMS. 429 means the resend was rate-limited. */
export const useSendOTP = () =>
  useMutation({
    mutationFn: async (body: OTPInput): Promise<void> => {
      await api.post("/auth/send_otp", body)
    },
  })

/**
 * Step 2 — exchanges the SMS code for a **temp** token, not a session.
 * The flow always continues to the TOTP step.
 */
export const useLogin = () =>
  useMutation({
    mutationFn: async (data: LoginInput): Promise<LoginResponse> => {
      const response = await api.post("/auth/login", data)
      return response.data
    },
  })

/** Whether the OTP step must show a captcha. Cheap, so it runs on page load. */
export const useRecaptchaCheck = () =>
  useQuery({
    queryKey: ["recaptcha-check"],
    queryFn: async (): Promise<RecaptchaCheckResponse> => {
      const response = await api.get("/auth/recaptcha_check")
      return response.data
    },
    staleTime: Infinity,
    retry: false,
  })

/**
 * Step 3a — the enrolment QR, fetched only when the user has no authenticator
 * yet. Authorized by the temp token, which `getAuthToken` prefers automatically.
 */
export const use2FASetup = (enabled: boolean) =>
  useQuery({
    queryKey: ["2fa-setup"],
    queryFn: async (): Promise<TwoFactorSetupResponse> => {
      const response = await api.get("/auth/2fa/setup")
      return response.data
    },
    enabled,
    staleTime: Infinity, // the QR does not need refreshing
  })

/** Step 3b — the only call that returns a real `accessToken`. */
export const use2FAEnable = () =>
  useMutation({
    mutationFn: async (data: TotpVerifyInput): Promise<LoginResponse> => {
      const response = await api.post("/auth/2fa/enable", data)
      return response.data
    },
  })

export const useLogout = () =>
  useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post("/auth/logout")
    },
  })

/**
 * Pulls a human-readable message out of a rejected request.
 *
 * Error bodies never pass through the camelizing response interceptor, so the
 * keys here are the backend's own snake_case.
 */
export function getAuthErrorMessage(
  error: unknown,
  fallback: string,
  /**
   * Shown when the request never left the building. Optional so the many
   * non-UI callers keep working; the sign-in screen passes a translated one.
   *
   * Note that `body.message` — the branch below — is the **server's** wording
   * and cannot be translated here. That is the backend's copy to localise; a
   * client-side dictionary cannot second-guess an arbitrary error string.
   */
  offlineMessage?: string
): string {
  if (!isAxiosError(error)) return fallback

  // The request never reached the server: DNS, CORS, offline.
  if (!error.response) {
    return offlineMessage ?? "Can't reach the server. Check your connection."
  }

  const body = error.response.data as AuthErrorBody | undefined

  const firstFieldError = body?.errors
    ? Object.values(body.errors).flat().find(Boolean)
    : undefined

  return firstFieldError ?? body?.message ?? fallback
}

/** True when a failed login is asking the user to solve a captcha. */
export function requiresRecaptcha(error: unknown): boolean {
  if (!isAxiosError(error)) return false
  return (error.response?.data as AuthErrorBody | undefined)?.require_recaptcha === true
}
```

`features/auth/types.ts` — full file:

```ts
import type { User } from "@/features/users/types"

/** Request/response shapes for the sign-in flow. See docs/authentication.md §3. */

export type OTPInput = {
  phone: string
}

export type LoginInput = {
  phone: string
  otp: string
  captchaToken: string | null
}

/**
 * Both login steps return this shape, but only one token each:
 * `/auth/login` gives `tempToken`, `/auth/2fa/enable` gives `accessToken`.
 */
export type LoginResponse = {
  accessToken?: string
  tempToken?: string
  tokenType?: string
  expiresIn?: number
  user: User
}

export type TwoFactorSetupResponse = {
  secret: string
  /** Raw SVG markup, not a data URL — inline it or base64-encode it yourself. */
  qrCode: string
}

export type TotpVerifyInput = {
  otp: string
}

export type RecaptchaCheckResponse = {
  recaptchaRequired: boolean
}

/**
 * The error body auth endpoints return. `require_recaptcha` is deliberately
 * snake_case: it is read off a *rejected* response, which never passes through
 * the camelizing interceptor.
 */
export type AuthErrorBody = {
  message?: string
  errors?: Record<string, string[]>
  require_recaptcha?: boolean
}
```

`features/auth/store.ts` — full file:

```ts
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
```

`features/auth/qr.ts` — full file:

```ts
/**
 * The enrolment QR from `GET /auth/2fa/setup`.
 *
 * The endpoint returns raw SVG markup — not a data URL, not a PNG (see
 * `docs/TFA-RESET-AND-QR-LOGIN.md` §2.2), so it has to be wrapped before
 * anything can render it.
 *
 * The same response carries a `secret`, and nothing formats or displays it:
 * scanning is the only enrolment path the sign-in screen offers.
 */

/**
 * Wrap the markup so an `<img>` can show it.
 *
 * `encodeURIComponent` rather than `btoa`: browser base64 is Latin-1 only and
 * throws `InvalidCharacterError` on any code point above U+00FF — which is
 * what happens the first time the server stamps an Arabic organization name
 * into the SVG's issuer label. Percent-encoding has no such ceiling.
 *
 * An `<img>` rather than `dangerouslySetInnerHTML`: SVG inlined into the
 * document can carry `<script>`, and this markup is server-supplied. Inside an
 * image it is a passive document — no script, no external fetches.
 */
export function qrCodeSrc(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
```

---

## 6. snake_case ⇄ camelCase: `utils/api/key-conversion.ts`

`utils/api/key-conversion.ts` — full file:

```ts
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
 *   applied per row for either list envelope and to the entity itself for a
 *   single `{ data: {...} }` one.
 * - otherwise → a plain recursive camelize.
 */
export function transformResponseKeys<T = unknown>(
  data: unknown,
  skipConfig?: SkipResponseConfig,
): T {
  if (skipConfig === true) return data as T
  if (!skipConfig || typeof skipConfig !== "object") return camelizeKeys<T>(data)

  const skip = skipConfig

  /**
   * The list envelope as it actually arrives.
   *
   * The interceptor hands this function `response.data` — the *body* — and a
   * list body is `{ data: [...], meta }`: rows one level down, not two. The
   * doubly-nested branch below reads like the same thing because `GetResponse`
   * describes the whole Axios response, where the body sits under another
   * `data`; it matches a body only when a single entity is nested under one.
   *
   * Without this branch a list falls through to the plain camelize at the
   * bottom and every skip is ignored — which is silent: the rows render, and
   * only the keys that were supposed to be left alone come back rewritten.
   */
  if (isPlainObject(data) && Array.isArray(data.data)) {
    return {
      ...camelizeSiblings(data, "data"),
      data: data.data.map((row) => camelizeExcept(row, skip)),
    } as T
  }

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
```

`types/xcase.d.ts` — full file:

```ts
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
```

### 6.1 What the conversion actually produces

Checked against `xcase@2.0.1` in this repo:

| Direction | Input | Output |
| --- | --- | --- |
| out | `organizationIds` | `organization_ids` |
| out | `perPage` | `per_page` |
| out | `frontImage` | `front_image` |
| out | `createdAtRange` | `created_at_range` |
| out | `tfaEnabled` | `tfa_enabled` |
| out | `address2Line` | `address2_line` |
| out | `template_id` (already snake) | `template_id` (unchanged) |
| out | `_method` | `_method` (unchanged) |
| out | **`userID`** | **`user_i_d`**: every capital letter becomes `_x`, so write `userId` |
| out | `joinData[0][fieldName]` (whole key) | `join_data[0][field_name]`: the nested part is converted too |
| out | `joinData[0][fieldName]` (root-only) | `join_data[0][fieldName]` |
| out | `address[city]`, `attachments[0]`, `fields[0][key]` | unchanged (already lower case) |
| in | `per_page` | `perPage` |
| in | `created_at` | `createdAt` |
| in | `access_token` / `temp_token` | `accessToken` / `tempToken` |
| in | `total_identities` | `totalIdentities` |
| in | `last_page` | `lastPage` |

Both `camelizeKeys` and `decamelizeKeys` recurse into nested objects and arrays:

```ts
decamelizeKeys({ organizationIds: ["22"], meta: { perPage: 10 }, rows: [{ createdAt: 1 }] })
// → { organization_ids: ["22"], meta: { per_page: 10 }, rows: [{ created_at: 1 }] }
```

### 6.2 Request side: `transformRequestKeys(data, options)`

```
skipConversion?                    → return data as-is
data instanceof FormData?          → build a NEW FormData, appending each entry under a converted key:
                                       preserveNestedFormDataKeys ? convertFormDataKeyRootOnly(key)
                                                                  : toSnakeCase(key)
                                     values (File, Blob, strings) are untouched
plain object or array?             → decamelizeKeys(data), recursive
anything else                      → return as-is (a JSON string, URLSearchParams, a Blob)
```

The FormData case builds a new instance because a `FormData` cannot be renamed in place.

### 6.3 Response side: `transformResponseKeys(data, skipConfig)`

```
skipConfig === true             → return data as-is (raw snake_case)
no skipConfig                   → camelizeKeys(data), recursive — the normal case
skipConfig is an object:
  body is { data: [...] , …}    → list envelope: siblings (meta, …) camelized; each row via camelizeExcept
  body is { data: { data: [...] } } → nested paginated: same, one level deeper
  body is { data: {…} }         → single entity: the inner object via camelizeExcept
  body is [...]                 → bare array: each row via camelizeExcept
  body is {…}                   → bare object: camelizeExcept
```

`camelizeExcept(row, skip)` splits the row's own top-level keys in two:

- keys **not** in `skip` → `camelizeKeys`, recursive;
- keys **in** `skip` (matched by the wire name *or* its camelCase form) → the key is camelized, but **its value is left exactly as it came**.

Example: the IDs resource uses `{ request: true }`. The `request` field holds the template's variable values, keyed by the template's own variable names:

```json
// wire
{ "data": [{ "id": 9, "unique_key": "A1B2", "request": { "full_name": "Ali", "exp_date": "2027-01-01" } }],
  "meta": { "current_page": 1, "per_page": 10, "total": 1 } }
```

```ts
// after transformResponseKeys(body, { request: true })
{ data: [{ id: 9, uniqueKey: "A1B2", request: { full_name: "Ali", exp_date: "2027-01-01" } }],
  meta: { currentPage: 1, perPage: 10, total: 1 } }
```

Without the skip, `request` would come back as `{ fullName, expDate }`, and no template would recognise those names.

The skip only applies to **top-level properties of each row**. You cannot skip a key nested deeper.

### 6.4 What is never converted

- **Error bodies.** The error branch of the interceptor does not convert anything ([§3.5](#35-the-response-interceptor-error-branch)).
- **Binary responses** (`responseType: "blob" | "arraybuffer"`).
- **Values.** Only keys change. A string value like `"created_at"` stays as it is.

---

## 7. Multipart bodies: `utils/objects.ts`

`utils/objects.ts` — full file:

```ts
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
```

What `objectToFormData` produces:

```ts
objectToFormData({
  name: "Ali",
  organizationId: 22,
  isActive: false,
  joinDate: new Date("2026-01-01T00:00:00Z"),
  avatar: fileFromInput,
  note: null,
  address: { city: "Baghdad" },
  attachments: [fileA, fileB],
  fields: [{ key: "blood", value: "O+" }],
})
```

| FormData key (built by `objectToFormData`) | Value | After the interceptor (whole-key) |
| --- | --- | --- |
| `name` | `"Ali"` | `name` |
| `organizationId` | `"22"` | `organization_id` |
| `isActive` | `"0"` (PHP reads the string `"false"` as true) | `is_active` |
| `joinDate` | `"2026-01-01T00:00:00.000Z"` | `join_date` |
| `avatar` | the `File` | `avatar` |
| *(note)* | *`null` is skipped, so no entry* | — |
| `address[city]` | `"Baghdad"` | `address[city]` |
| `attachments[0]`, `attachments[1]` | the `File`s | unchanged |
| `fields[0][key]`, `fields[0][value]` | `"blood"`, `"O+"` | unchanged |

Order matters: `objectToFormData` runs **first**, inside the factory or the hook, and gives camelCase keys. **Then** the request interceptor rebuilds the FormData with snake_case keys. Two settings change that second step:

- `disableRequestKeyConversion` / `skipRequestKeyConversion`: the keys are sent exactly as `objectToFormData` wrote them. IDs use this because their keys are already snake_case and are template variable names.
- `preserveNestedFormDataKeys`: only the root is converted, so app-owned nested keys like `[fieldName]` survive.

### PHP method spoofing

PHP does not parse a multipart body on a real `PUT`. So a multipart update is sent as **`POST` with a `_method=PUT` field**, and Laravel treats it as a PUT. The factory does this for any `isFormData` resource ([§11](#11-the-api-factory-utilsapiapi-factoryts)). Hand-written multipart updates must append it themselves (`useApproveId`, `useUpdateIdVars`).

---

## 8. Shared types: `types/api.ts`

`types/api.ts` — full file:

```ts
/**
 * Shared request/response shapes for the network layer.
 *
 * See docs/network-layer.md §5. These describe the *wire contract* after the
 * response interceptor has camelized keys — feature code never sees snake_case.
 */

/** Every resource driven by the API factory is addressable by `id`. */
export type BaseEntity = {
  id: string | number
}

/** One sort instruction. Currently travels in the query key only (see below). */
export type SortQuery = {
  field: string
  order: "asc" | "desc"
}

/**
 * What a filter can hold. Arrays become repeated params (`?statuses[]=a&…`);
 * `0` and `false` are legitimate values, not "unset" — see `buildFilter`.
 */
export type FilterValue = string | number | boolean | string[] | number[]

/** One filter clause. `{ field: "search", value: "ali" }` serializes to `?search=ali`. */
export type FilterQuery = {
  field: string
  value: FilterValue
}

/** The argument every list endpoint takes. */
export type BaseQuery = {
  page: number
  pageSize?: number
  sort?: SortQuery
  filter?: FilterQuery[]
  include?: string
}

/**
 * Pagination envelope the backend wraps every list in.
 *
 * Every field is optional because not every list endpoint sends a `meta` block
 * at all — some return a bare paginator with these keys at the root instead.
 * `readPageInfo` (utils/api/pagination.ts) is what reconciles the two; read
 * page numbers through it rather than off `meta` directly.
 */
export type PaginationMeta = {
  total?: number
  currentPage?: number
  perPage?: number
  lastPage?: number
}

/** The normalized result of `readPageInfo` — any field may be unknown. */
export type PageInfo = {
  total?: number
  currentPage?: number
  /** Rows per page the server actually used, which can differ from the request. */
  perPage?: number
  lastPage?: number
}

/**
 * The paginated response body. Note the double nesting: `useGetList` hands back
 * the whole Axios response, so rows end up at `query.data.data.data`.
 */
export type GetResponse<T> = {
  data: {
    data: T
    /** Absent on endpoints that return a bare paginator — see `PaginationMeta`. */
    meta?: PaginationMeta
  }
}

/** The single-resource envelope, used by `useGetById`. */
export type GetByIdResponse<T> = {
  data: T
}

/** Validation errors come back keyed by field, each holding a list of messages. */
export type ApiErrorBody = {
  message?: string
  errors?: Record<string, string[]>
}
```

### Type by type

| Type | Meaning | Who uses it |
| --- | --- | --- |
| `BaseEntity` | Anything with an `id` (string or number) | The factory's `TEntity` must extend it, because `useGetById`, `useUpdate` and `useDelete` build `/endpoint/{id}` |
| `SortQuery` | `{ field, order }` | Travels in the query key only. `serializeQuery` does not send it yet |
| `FilterValue` | `string \| number \| boolean \| string[] \| number[]` | One clause's value. Arrays become `key[]=a&key[]=b` |
| `FilterQuery` | `{ field, value }` | One clause. `field` is the **camelCase** param name; the interceptor decamelizes it |
| `BaseQuery` | `{ page, pageSize?, sort?, filter?, include? }` | What every list hook takes. Usually built by `useListQuery` |
| `PaginationMeta` | `{ total?, currentPage?, perPage?, lastPage? }` | The `meta` block, when the server sends one. Every field is optional |
| `PageInfo` | The same four numbers, normalized | What `readPageInfo` returns |
| `GetResponse<T>` | `{ data: { data: T; meta? } }` | The **whole Axios response** of a list hook |
| `GetByIdResponse<T>` | `{ data: T }` | The single-entity envelope. Kept for reference; the factory now unwraps for you |
| `ApiErrorBody` | `{ message?, errors?: Record<string, string[]> }` | A rejected request's `error.response.data`. Keys are **snake_case** |

### The double `data` in `GetResponse`

```
const q = useGetMembers(query)

q.data                 AxiosResponse          { data, status, statusText, headers, config, request }
q.data.data            the response body      { data: Member[], meta?: PaginationMeta }   (or a bare paginator)
q.data.data.data       the rows               Member[]
q.data.data.meta       pagination, if sent     — read it through readPageInfo(q.data.data) instead
```

An `AxiosResponse<{ data: T[]; meta }>` fits the `GetResponse<T[]>` type because the type only declares the `data` property.

### Entity types live with their feature

Each `features/<feature>/types.ts` declares the entity in **camelCase**, the shape after the interceptor, plus its inputs. Members as an example:

`features/members/types.ts` — full file:

```ts
import type { Organization } from "@/features/organizations/types"

/**
 * Members — a person who can receive ID cards. See docs/api-types.md § members.
 *
 * Approving a `MemberRequest` produces one of these, so the two shapes are
 * close relatives. They are **not** interchangeable, and the differences are
 * the kind that compile cleanly and fail at runtime:
 *
 *  - `organizations` here is an **array** (many-to-many). A member request
 *    carries a single `organization`.
 *  - the write inputs take `organizationIds`, an **array of strings** — the
 *    endpoint validates `organization_ids` and rejects a singular
 *    `organization_id` as a missing field. A member request carries a single
 *    `organizationId`, and that one *is* a string too.
 *  - There is no `status`. A member exists because a request was approved;
 *    there is no pending or rejected member.
 *
 * The input type names collide with `features/members-requests` too — import
 * them explicitly rather than by memory (docs/api-types.md § members-requests,
 * gotcha 2).
 *
 * Shapes are camelCase because that is what the code sees; the wire format is
 * snake_case and the interceptors convert both ways.
 */
export type Member = {
  id: number
  phone: string
  name: string
  createdAt: string
  updatedAt: string
  /** Image URL, absent when the member has no photo. */
  avatar?: string
  joinDate?: string | null
  /** Plural, and documented as always present — many-to-many. */
  organizations: Organization[]
}

/**
 * `organizationIds` is **plural and an array** — the interceptor decamelizes it
 * to `organization_ids`, which is the only spelling the endpoint accepts. A
 * singular `organization_id` comes back as *"The organization ids field is
 * required."* Members-requests takes a singular `organizationId` instead.
 */
export type CreateMembersInput = {
  phone: string
  name: string
  organizationIds?: string[]
} & Record<string, unknown>

/** `name` is required on update even when only the phone is changing. */
export type UpdateMembersInput = {
  phone?: string
  name: string
  organizationIds?: string[]
} & Record<string, unknown>

/**
 * The bulk Excel import.
 *
 * `organization_id` is snake_case in this one input — the endpoint reads it
 * verbatim, so the usual camelCase-and-let-the-interceptor-convert rule does
 * not apply here.
 */
export type UploadMembersInput = {
  file: File
  organization_id?: number
} & Record<string, unknown>
```

Two conventions are visible here:

- `& Record<string, unknown>` on the inputs. The factory's `TCreateInput` / `TUpdateInput` must extend `Record<string, unknown>` so they can be passed to `objectToFormData`.
- An input that the server reads verbatim (`UploadMembersInput.organization_id`) is written in snake_case on purpose, and says so.

---

## 9. Query strings: `serializeQuery` and `buildFilter`

`utils/api/api.ts` — full file:

```ts
import type { BaseQuery } from "@/types/api"

/**
 * Query param serialization for list endpoints. See docs/network-layer.md §5.
 *
 * The output is still camelCase — the request interceptor decamelizes params
 * on the way out, so `perPage` would become `per_page` anyway. `pageSize` is
 * mapped explicitly because the API name differs, not just the casing.
 */
export const serializeQuery = (query: BaseQuery) => {
  const params: Record<string, string | number | boolean | string[] | number[]> =
    {}

  if (query.page) params["page"] = query.page
  if (query.pageSize) params["per_page"] = query.pageSize
  if (query.include) params["include"] = query.include

  // Sorting is not sent yet — the backend has no contract for it. `sort` still
  // travels in the React Query key, so changing it busts the cache.
  // if (query.sort) {
  //   params["sort"] = query.sort.field
  //   params["order"] = query.sort.order
  // }

  if (query.filter) {
    // { field: "search", value: "ali" } → ?search=ali
    for (const clause of query.filter) {
      params[clause.field] = clause.value
    }
  }

  return params
}
```

`utils/api/filters.ts` — full file:

````ts
import type { FilterQuery, FilterValue } from "@/types/api"

/**
 * Turns a plain record of filter values into the clause array every list hook
 * takes. See docs/filtering-sorting-pagination.md §6.
 *
 * ```ts
 * buildFilter({ search, phone, statuses, organizationId })
 * // → [{ field: "organizationId", value: "3" }, { field: "phone", … }, …]
 * ```
 *
 * Two things it guarantees, both of which are easy to get wrong by hand:
 *
 * 1. **Empty means absent.** `""`, `null`, `undefined` and `[]` drop the clause
 *    entirely rather than sending `?search=`. Clearing a box produces an
 *    unfiltered request, not a request for the empty string. `0` and `false`
 *    are *not* empty — they are legitimate values and survive.
 * 2. **Order is stable.** Clauses come out sorted by field name, so the same
 *    set of filters always produces the same array — and therefore the same
 *    React Query key, whatever order the caller happened to write them in.
 *    Insertion order would give one screen two cache entries for one state.
 */
export function buildFilter(
  values: Record<string, FilterValue | null | undefined>
): FilterQuery[] {
  return Object.entries(values)
    .filter(([, value]) => !isEmpty(value))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([field, value]) => ({ field, value: value as FilterValue }))
}

/** `""`, `null`, `undefined` and `[]`. Deliberately not `0` or `false`. */
function isEmpty(value: FilterValue | null | undefined): boolean {
  if (value === null || value === undefined || value === "") return true
  return Array.isArray(value) && value.length === 0
}
````

### `serializeQuery(query)` field by field

| `BaseQuery` field | Param it becomes | Notes |
| --- | --- | --- |
| `page` | `page` | Skipped if `0` or missing |
| `pageSize` | `per_page` | Mapped by name, because the API calls it something different |
| `include` | `include` | Relations to embed, for endpoints that support it |
| `sort` | *(nothing)* | Not sent: the backend has no sort contract. It is still in the query key, so changing it refetches |
| `filter[]` | `clause.field` = `clause.value`, one param per clause | `{ field: "search", value: "ali" }` → `search=ali` |

The result is still partly camelCase (`organizationIds`). The request interceptor decamelizes params afterwards, so the URL always has snake_case.

### From filter values to URL

| `buildFilter` input | Clause | URL |
| --- | --- | --- |
| `{ search: "ali" }` | `{ field: "search", value: "ali" }` | `search=ali` |
| `{ search: "" }` | *(dropped)* | *(nothing)* |
| `{ organizationIds: ["22","23"] }` | `{ field: "organizationIds", value: [...] }` | `organization_ids[]=22&organization_ids[]=23` |
| `{ organizationIds: [] }` | *(dropped)* | *(nothing)* |
| `{ statuses: [0] }` | kept: `0` is a real value | `statuses[]=0` |
| `{ isActive: false }` | kept: `false` is a real value | `is_active=false` |
| `{ createdAtRange: undefined }` | *(dropped)* | *(nothing)* |

Why `buildFilter` sorts: React Query hashes query keys structurally. Objects are compared with their keys sorted, but **arrays are compared in order**. Without the sort, the same filters written in a different order would make two cache entries for one view.

**An unknown field name fails without any error.** If you send `organizationId` where the server expects `organization_ids`, the server ignores it, nothing errors, and the list comes back unfiltered. Check the param name against [docs/identities-api.postman_collection.json](docs/identities-api.postman_collection.json) or [docs/api-types.md](docs/api-types.md).

---

## 10. Pagination: `readPageInfo`

`utils/api/pagination.ts` — full file:

```ts
import type { PageInfo } from "@/types/api"

/**
 * Reads the pagination numbers out of a list response body.
 *
 * Two envelopes are in the wild for these endpoints. The documented one is
 * `{ data: [...], meta: { total, currentPage, perPage } }`
 * (docs/api-types.md § response envelopes). A controller that returns a
 * Laravel paginator straight out instead produces
 * `{ data: [...], total, lastPage, perPage, currentPage }` — **no `meta`**.
 *
 * Rows sit at `body.data` in both, which is exactly why a table can render
 * perfectly and still have a dead Next button: the row count is found, the
 * total is not, and every control that depends on the total goes quiet.
 *
 * So: look in `meta` first, fall back to the body root, and coerce — a
 * paginator serialized through PHP hands several of these back as strings.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Numbers only, and only real ones — `"12"` counts, `""`, `null` and `NaN` do not. */
function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export function readPageInfo(body: unknown): PageInfo {
  const root = isRecord(body) ? body : undefined
  const meta = root && isRecord(root.meta) ? root.meta : undefined

  const pick = (key: string) => toNumber(meta?.[key]) ?? toNumber(root?.[key])

  const total = pick("total")
  const perPage = pick("perPage")

  // `lastPage` is the honest source when the backend sends it. Otherwise derive
  // it from the total and the page size the *server* used — which is not always
  // the one that was asked for.
  const lastPage =
    pick("lastPage") ??
    (total !== undefined && perPage !== undefined && perPage > 0
      ? Math.max(1, Math.ceil(total / perPage))
      : undefined)

  return { total, perPage, lastPage, currentPage: pick("currentPage") }
}
```

The server sends lists in two shapes:

```jsonc
// documented: a meta block
{ "data": [ … ], "meta": { "total": 42, "current_page": 2, "per_page": 10 } }

// observed: a Laravel paginator returned as-is — no meta
{ "data": [ … ], "total": "42", "last_page": 5, "per_page": "10", "current_page": 2 }
```

Rows are at `body.data` in both. So a table can render fine with a dead Next button, because the total was looked for in the wrong place. `readPageInfo(body)`:

1. looks for each number in `meta` first, then at the body root;
2. turns `"42"` into `42`, but treats `""`, `null` and `NaN` as unknown;
3. uses `lastPage` when the server sends it, otherwise `ceil(total / perPage)` using the server's `perPage`, not the one you asked for.

```ts
readPageInfo({ data: [], meta: { total: 42, perPage: 10, currentPage: 2 } })
// → { total: 42, perPage: 10, lastPage: 5, currentPage: 2 }

readPageInfo({ data: [], total: "42", lastPage: 5, perPage: "10", currentPage: 2 })
// → { total: 42, perPage: 10, lastPage: 5, currentPage: 2 }

readPageInfo({ data: [] })
// → { total: undefined, perPage: undefined, lastPage: undefined, currentPage: undefined }
```

Pass it `query.data?.data`, the **body**, not `query.data`. A missing total means *unknown*, never zero. Zero would disable Next and show "No results" above rows that are plainly there.

---

## 11. The API factory: `utils/api/api-factory.ts`

`utils/api/api-factory.ts` — full file:

```ts
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/api/client"
import type { BaseEntity, BaseQuery, GetResponse, PaginationMeta } from "@/types/api"
import type { RequestOptions } from "@/types/axios"
import { serializeQuery } from "@/utils/api/api"
import { objectToFormData } from "@/utils/objects"

/**
 * Generates the full CRUD hook set plus a query-key factory for one REST
 * resource. See docs/network-layer.md §6.
 *
 * A feature's api.ts instantiates this once, re-exports the hooks under domain
 * names, and hand-writes only what the factory does not cover.
 */

export type ApiFactoryConfig = {
  /** Root of the query key, e.g. "member". */
  entityName: string
  /** REST path relative to the client's baseURL, e.g. "/member". */
  endpoint: string
  /** Send multipart bodies instead of JSON — set only if the resource uploads files. */
  isFormData?: boolean
  /** For payloads whose keys are already snake_case; double conversion mangles them. */
  disableRequestKeyConversion?: boolean
  /** Passed straight to the response interceptor. See docs/network-layer.md §2. */
  skipResponseKeyConversion?: boolean | Record<string, boolean>
  /** Opt out of PHP method spoofing on multipart updates (see below). */
  disableMethodKeyForPut?: boolean
  /** Convert only the root segment of bracket-notation FormData keys. */
  preserveNestedFormDataKeys?: boolean
}

export type QueryKeyFactory = {
  all: () => readonly unknown[]
  list: (filter?: unknown) => readonly unknown[]
  byId: (id: string | number) => readonly unknown[]
}

/** The default error type: every hook rejects with an Axios error. */
export type ApiError = AxiosError

/**
 * One entity, out of whatever envelope it arrived in.
 *
 * `GET /endpoint/{id}` is *documented* as returning the row directly
 * (docs/api-types.md § Response envelopes) and *observed* returning it wrapped
 * in the same `data` envelope the list endpoints use — the identical split
 * `readFlowNodes` in features/template-flow/api.ts already records for
 * `/template/flow/{id}`, and for the same reason: the envelope is the API's
 * convention and the docs describe the shape somebody expected.
 *
 * Guessing wrong fails **silently**. Handing back `{ data: row }` where a row
 * was promised makes every field read as `undefined`, so nothing throws, no
 * request errors, and the screen just comes up empty — which is how a template
 * opened in the editor with none of its design and none of its metadata.
 *
 * So neither shape is assumed. A wrapper is recognised by what it *lacks*: an
 * envelope carries `data` and none of the entity's own columns, while a row
 * that happens to have its own `data` column still has an `id`. Anything
 * ambiguous is left exactly as it came.
 */
function unwrapEntity<TEntity>(body: unknown): TEntity {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !("data" in body) ||
    "id" in body
  ) {
    return body as TEntity
  }

  const inner = (body as { data: unknown }).data
  return inner && typeof inner === "object" && !Array.isArray(inner)
    ? (inner as TEntity)
    : (body as TEntity)
}

type QueryOptions<TData> = Omit<
  UseQueryOptions<TData, ApiError, TData>,
  "queryKey" | "queryFn"
>

type MutationOptions<TData, TVariables> = Omit<
  UseMutationOptions<TData, ApiError, TVariables>,
  "mutationFn"
>

export function createApiFactory<
  TEntity extends BaseEntity,
  TCreateInput extends Record<string, unknown> = Record<string, unknown>,
  TUpdateInput extends Record<string, unknown> = Record<string, unknown>,
>(config: ApiFactoryConfig) {
  const {
    entityName,
    endpoint,
    isFormData = false,
    disableRequestKeyConversion = false,
    skipResponseKeyConversion,
    disableMethodKeyForPut = false,
    preserveNestedFormDataKeys = false,
  } = config

  /** The per-request interceptor overrides this resource always sends. */
  const requestOptions: RequestOptions = {
    skipRequestKeyConversion: disableRequestKeyConversion,
    skipResponseKeyConversion,
    preserveNestedFormDataKeys,
  }

  /**
   * Keys nest, so invalidating `all()` invalidates lists and detail queries
   * alike — and any custom key a feature spreads on top of them.
   */
  const QueryKeys: QueryKeyFactory = {
    all: () => [entityName] as const,
    list: (filter?: unknown) => [...QueryKeys.all(), filter] as const,
    byId: (id: string | number) => [...QueryKeys.all(), id] as const,
  }

  /** Builds the body for a write, honouring `isFormData`. */
  function buildRequestBody(data: Record<string, unknown>) {
    if (!isFormData) {
      return { body: data as unknown, headers: undefined }
    }
    return {
      body: objectToFormData(data),
      headers: { "Content-Type": "multipart/form-data" },
    }
  }

  const useGetList = (
    filter: BaseQuery,
    options?: QueryOptions<GetResponse<TEntity[]>>,
  ) =>
    useQuery({
      // `filter` in the key includes `sort`, so changing sort refetches even
      // though the server is not sent a sort param yet.
      queryKey: QueryKeys.list(filter),
      queryFn: async (): Promise<GetResponse<TEntity[]>> => {
        // Returns the *whole* response: rows end up at `query.data.data.data`.
        return await api.get<{ data: TEntity[]; meta: PaginationMeta }>(endpoint, {
          params: serializeQuery(filter),
          options: requestOptions,
        })
      },
      ...options,
    })

  const useGetById = (
    id: string | number | undefined,
    options?: QueryOptions<TEntity>,
  ) =>
    useQuery({
      queryKey: QueryKeys.byId(id as string | number),
      queryFn: async (): Promise<TEntity> => {
        const response = await api.get<TEntity>(`${endpoint}/${id}`, {
          options: requestOptions,
        })
        return unwrapEntity<TEntity>(response.data)
      },
      // Never fires before an id exists — avoids a `/endpoint/undefined` request.
      enabled: !!id,
      ...options,
    })

  const useCreate = (options?: MutationOptions<TEntity, TCreateInput>) => {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (data: TCreateInput): Promise<TEntity> => {
        const { body, headers } = buildRequestBody(data)
        const response = await api.post<TEntity>(endpoint, body, {
          headers,
          options: requestOptions,
        })
        return unwrapEntity<TEntity>(response.data)
      },
      ...options,
      // Every mutation refreshes the resource, so tables update themselves and
      // callers never invalidate by hand. Any `onSuccess` passed in still runs.
      onSuccess: (data, variables, onMutateResult, context) => {
        queryClient.invalidateQueries({ queryKey: QueryKeys.all() })
        options?.onSuccess?.(data, variables, onMutateResult, context)
      },
    })
  }

  const useUpdate = (
    options?: MutationOptions<TEntity, { id: string | number; data: TUpdateInput }>,
  ) => {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async ({
        id,
        data,
      }: {
        id: string | number
        data: TUpdateInput
      }): Promise<TEntity> => {
        const { body, headers } = buildRequestBody(data)

        // PHP cannot parse a multipart body on a real PUT, so multipart updates
        // are POSTed with a `_method` override field instead.
        if (isFormData && !disableMethodKeyForPut) {
          ;(body as FormData).append("_method", "PUT")
        }

        const response = isFormData
          ? await api.post<TEntity>(`${endpoint}/${id}`, body, {
              headers,
              options: requestOptions,
            })
          : await api.put<TEntity>(`${endpoint}/${id}`, body, {
              headers,
              options: requestOptions,
            })

        return unwrapEntity<TEntity>(response.data)
      },
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        queryClient.invalidateQueries({ queryKey: QueryKeys.all() })
        options?.onSuccess?.(data, variables, onMutateResult, context)
      },
    })
  }

  const useDelete = (options?: MutationOptions<void, string | number>) => {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (id: string | number): Promise<void> => {
        await api.delete(`${endpoint}/${id}`, { options: requestOptions })
      },
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        queryClient.invalidateQueries({ queryKey: QueryKeys.all() })
        options?.onSuccess?.(data, variables, onMutateResult, context)
      },
    })
  }

  return { QueryKeys, useGetList, useGetById, useCreate, useUpdate, useDelete }
}
```

### 11.1 The generics

```ts
createApiFactory<TEntity extends BaseEntity, TCreateInput = Record<string, unknown>, TUpdateInput = Record<string, unknown>>(config)
```

| Parameter | Is | Flows into |
| --- | --- | --- |
| `TEntity` | The row as the app sees it (camelCase, has `id`) | What `useGetList` rows, `useGetById`, `useCreate` and `useUpdate` return |
| `TCreateInput` | The body `useCreate().mutate(…)` accepts | `mutationFn(data: TCreateInput)` |
| `TUpdateInput` | The `data` in `useUpdate().mutate({ id, data })` | `mutationFn({ id, data: TUpdateInput })` |

Read-only resources pass only `TEntity` (`createApiFactory<Payment>`). The write hooks still exist; the feature just does not export them.

### 11.2 Config, option by option

| Option | Default | Effect | Set by |
| --- | --- | --- | --- |
| `entityName` | required | The root of every query key: `["member", …]` | every factory |
| `endpoint` | required | The REST path, relative to `baseURL` | every factory |
| `isFormData` | `false` | Writes go through `objectToFormData`, and updates become `POST` + `_method=PUT` | `members-requests`, `organizations`, `ids` |
| `disableRequestKeyConversion` | `false` | Sent as `options.skipRequestKeyConversion` | `ids` |
| `skipResponseKeyConversion` | `undefined` | Sent as `options.skipResponseKeyConversion` | `ids` (`{ request: true }`) |
| `disableMethodKeyForPut` | `false` | A multipart update is still a `POST`, but without `_method=PUT` | none yet |
| `preserveNestedFormDataKeys` | `false` | Sent as `options.preserveNestedFormDataKeys` | none yet |

The three conversion settings become one `requestOptions` object, built once, and passed as `{ options: requestOptions }` on **every** request the factory makes: reads and writes.

### 11.3 `QueryKeys`: the cache tree

```ts
QueryKeys.all()        // ["member"]
QueryKeys.list(filter) // ["member", { page: 2, pageSize: 10, filter: [...] }]
QueryKeys.byId(7)      // ["member", 7]
```

React Query matches keys **by prefix**. `invalidateQueries({ queryKey: ["member"] })` reaches every key that starts with `"member"`:

```
["member"]                                              ← all(): every factory write invalidates this
 ├─ ["member", { page: 1, pageSize: 10 }]               ← a list page (also the header count)
 ├─ ["member", { page: 2, pageSize: 10, filter: […] }]  ← another list page
 └─ ["member", 7]                                       ← one member

["branch"]
 ├─ ["branch", { page: 1, pageSize: 10 }]
 ├─ ["branch", 3]
 └─ ["branch", "template", 12]                           ← custom key spread on top (features/branches)

["identity"]
 ├─ ["identity", { page: 1, … }]
 ├─ ["identity", "node", { page: 1, … }]                 ← the approval inbox (features/ids)
 └─ ["identity", 9]
```

That is why custom keys should start with the factory's keys (`[...X.QueryKeys.all(), "sub", id]`): the factory's own mutations then refresh them too.

### 11.4 The hooks, one by one

#### `useGetList(filter, options?)`

| | |
| --- | --- |
| Request | `GET {endpoint}?{serializeQuery(filter)}`, with `options: requestOptions` |
| Query key | `QueryKeys.list(filter)`: the whole `BaseQuery`, `sort` included |
| Returns | `GetResponse<TEntity[]>`: the **whole Axios response**. Rows are at `.data.data.data` |
| Options | Any `useQuery` option except `queryKey` / `queryFn`: `enabled`, `placeholderData`, `select`, `staleTime`, `refetchInterval`… |

```ts
// example
const q = useGetBranches({ page: 1, pageSize: 100 }, { enabled: open })
const branches = q.data?.data.data ?? []
```

#### `useGetById(id, options?)`

| | |
| --- | --- |
| Request | `GET {endpoint}/{id}` |
| Query key | `QueryKeys.byId(id)` |
| Returns | `TEntity`, unwrapped by `unwrapEntity` |
| Guard | `enabled: !!id`, so nothing is sent until there is an id (no `/member/undefined`). Note: an `enabled` you pass **replaces** this guard, because `...options` comes after it |

`unwrapEntity` decides whether the body is a wrapper or the row itself:

| Body | Has `data`? | Has `id`? | `data` is a plain object? | Result |
| --- | --- | --- | --- | --- |
| `{ data: { id: 7, name } }` | yes | no | yes | `{ id: 7, name }` (unwrapped) |
| `{ id: 7, name }` | no | — | — | as-is |
| `{ id: 7, data: { … } }` | yes | **yes** | — | as-is: a row that has its own `data` column |
| `{ data: [ … ] }` | yes | no | no (array) | as-is |
| `null` / array / string | — | — | — | as-is |

#### `useCreate(options?)`

| | |
| --- | --- |
| Request | `POST {endpoint}`: JSON, or `objectToFormData(data)` when `isFormData` |
| Variables | `TCreateInput` |
| Returns | `TEntity` (unwrapped) |
| On success | `invalidateQueries(QueryKeys.all())`, **then** your `options.onSuccess` |

#### `useUpdate(options?)`

| | JSON resource | `isFormData` resource |
| --- | --- | --- |
| Request | `PUT {endpoint}/{id}`, JSON body | `POST {endpoint}/{id}`, multipart, plus `_method=PUT` (unless `disableMethodKeyForPut`) |
| Variables | `{ id, data: TUpdateInput }` | same |
| Returns | `TEntity` (unwrapped) | same |
| On success | invalidate `all()`, then your `onSuccess` | same |

#### `useDelete(options?)`

| | |
| --- | --- |
| Request | `DELETE {endpoint}/{id}` |
| Variables | the id |
| Returns | `void` |
| On success | invalidate `all()`, then your `onSuccess` |

### 11.5 How mutation options combine

```ts
useMutation({
  mutationFn,
  ...options,                 // your onError, onSettled, onMutate, retry, meta… pass straight through
  onSuccess: (…) => {         // written AFTER the spread, so yours cannot replace it
    queryClient.invalidateQueries({ queryKey: QueryKeys.all() })
    options?.onSuccess?.(…)   // yours still runs, after the invalidation starts
  },
})
```

In TanStack Query 5.102, `onSuccess` gets four arguments: `(data, variables, onMutateResult, context)`. The factory passes all four through.

You can also pass callbacks **per call**. React Query runs the hook-level ones first, then the call-level ones:

```ts
// example
const update = useUpdateMember({ onSuccess: () => toastSaved() }) // hook level: every call
update.mutate({ id, data }, { onSuccess: () => close() })         // call level: this call only
```

`invalidateQueries` is not awaited, so your `onSuccess` runs while the refetch is still in flight. Active queries refetch now. Inactive ones are only marked stale and refetch when a screen mounts them again.

---

## 12. React Query: `providers/react-query-provider.tsx`

`providers/react-query-provider.tsx` — full file:

```tsx
"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { isAxiosError } from "axios"

/**
 * Server-state provider. See docs/network-layer.md §9.
 *
 * The client is created inside `useState` rather than at module scope so it is
 * not shared between requests during SSR — a module-level client would leak one
 * user's cached data into another's render.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Long enough that hydration does not immediately refetch everything.
        staleTime: 60 * 1000,
        retry: (failureCount, error) => {
          const status = isAxiosError(error) ? error.response?.status : undefined

          if (status && status >= 400 && status < 500) {
            // Client errors will fail again identically — except throttling and
            // request timeout, which are worth another go.
            return status === 408 || status === 429 ? failureCount < 3 : false
          }

          return failureCount < 3
        },
        // Exponential backoff, capped at 30s.
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
    },
  })
}

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(makeQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  )
}
```

Mounted once, in [app/[lang]/layout.tsx](app/[lang]/layout.tsx):

```tsx
// excerpt
<I18nProvider locale={lang} dict={dict}>
  <ReactQueryProvider>
    <ThemeProvider>
      <IntroSplash />
      {children}
    </ThemeProvider>
  </ReactQueryProvider>
</I18nProvider>
```

### Settings

| Setting | Value | Effect |
| --- | --- | --- |
| `staleTime` | 60 s | For 60 s after a fetch, mounting the same key reads the cache with no request. After that, data is shown from cache **and** refetched in the background |
| `retry` | function below | Applies to **queries only**. Mutations keep React Query's default of no retries |
| `retryDelay` | `min(1000 · 2^attempt, 30000)` | 1 s, then 2 s, then 4 s |
| (default) `refetchOnWindowFocus` | `true` | Coming back to the tab refetches stale queries that are on screen |
| (default) `gcTime` | 5 min | A query no screen uses is dropped from memory 5 min later |

Retry decisions (`failureCount` counts from 0 at the first failure):

| Failure | Retried? | Total attempts |
| --- | --- | --- |
| No response (offline, DNS, CORS) | yes | up to 4 (1 + 3 retries) |
| `5xx` | yes | up to 4 |
| `408` Request Timeout, `429` Too Many Requests | yes | up to 4 |
| any other `4xx` (400, 401, 403, 404, 422…) | **no** | 1 |
| A hook with its own `retry` (`useRecaptchaCheck` has `retry: false`) | its own rule | — |

Why the `QueryClient` lives in `useState`: a client at module level would be shared by every request the server renders, so one user's cache could leak into another user's HTML. `useState(makeQueryClient)` makes one per browser tab. On the server, one per render.

The devtools (a floating button in the corner of the page) only render when `NODE_ENV === "development"`. Open them to see every query key, its state and its cached data.

---

## 13. Feature API modules: the three patterns

Every `features/<feature>/api.ts` follows one of three patterns.

### Pattern A: factory only

The resource is plain CRUD. Create the factory once and re-export its hooks under domain names.

`features/members/api.ts` — full file:

```ts
import { createApiFactory } from "@/utils/api/api-factory"
import type { CreateMembersInput, Member, UpdateMembersInput } from "./types"

/**
 * Members. See docs/api-types.md § members for every shape, and
 * docs/network-layer.md §7 for the module convention.
 *
 * ### Not multipart
 *
 * Unlike `member_request`, this resource is **not** listed as a FormData
 * endpoint (docs/api-types.md § entity index), so writes go out as JSON and
 * updates use a real `PUT` rather than the `_method=PUT` spoof PHP needs for
 * multipart bodies. `Member.avatar` is a URL the API returns, not a file this
 * endpoint takes.
 *
 * ### Documented but not built
 *
 * Three hooks in the doc's table have no implementation here:
 *
 *  - `useUploadMembers` (`POST /member/excel`) — the bulk Excel import. It is
 *    the one write on this resource that *is* multipart, so it cannot come
 *    from the factory above; it needs a hand-written mutation and a screen to
 *    call it, and there is no import UI yet.
 *  - `useGetMemberIdentities` (`GET /member/{id}/identity`) — returns
 *    `IDCard[]`, and no `features/ids` module exists to type them against.
 *  - `useGetMemberOrganizations` (`GET /member/{id}/organization`) — the
 *    member's orgs are already on the row as `organizations`, so nothing
 *    needs a second request for them yet.
 *
 * They are named here rather than silently missing: an exported hook reads as
 * a supported one, and the same reasoning governs `features/organizations`.
 */
const membersApi = createApiFactory<Member, CreateMembersInput, UpdateMembersInput>({
  entityName: "member",
  endpoint: "/member",
})

export const MemberQueryKeys = membersApi.QueryKeys

export const useGetMembers = membersApi.useGetList
export const useGetMember = membersApi.useGetById
export const useCreateMember = membersApi.useCreate
export const useUpdateMember = membersApi.useUpdate
export const useDeleteMember = membersApi.useDelete
```

Things to notice:

- `MemberQueryKeys` is exported so other code can invalidate members (`queryClient.invalidateQueries({ queryKey: MemberQueryKeys.all() })`).
- Hooks the documentation lists but that are not built are **named in a comment, not exported**. An exported hook reads as supported.
- Read-only resources export only the read hooks (`payments`, `permissions`), and resources with no `PUT` leave out `useUpdate` (`black-list`). See the [appendix](#appendix-the-remaining-feature-modules-in-full).

### Pattern B: factory plus hand-written hooks

Hand-written hooks follow the same contract as the factory: they use the shared `api`, they put their keys under the factory's prefix, and they invalidate on success.

**A multipart resource with a custom action:**

`features/members-requests/api.ts` — full file:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"

import api from "@/api/client"
import { createApiFactory } from "@/utils/api/api-factory"
import type {
  ChangeMemberStatusInput,
  CreateMembersInput,
  MemberRequest,
  UpdateMembersInput,
} from "./types"

/**
 * Member requests. See docs/api-types.md § members-requests for every shape,
 * and docs/network-layer.md §7 for the module convention.
 *
 * Hook names follow the documented API surface, which is a little uneven:
 * `useGetMembersRequests` is the *list*, `useGetMemberRequests` the *detail*.
 * Import them explicitly rather than by memory.
 */
const membersRequestsApi = createApiFactory<
  MemberRequest,
  CreateMembersInput,
  UpdateMembersInput
>({
  entityName: "member-request",
  endpoint: "/member_request",
  // Applications carry an avatar and an attachment, so writes are multipart —
  // which is also why updates POST with `_method=PUT` (PHP can't parse a
  // multipart body on a real PUT). The factory handles that.
  isFormData: true,
})

export const MemberRequestQueryKeys = membersRequestsApi.QueryKeys

export const useGetMembersRequests = membersRequestsApi.useGetList
export const useGetMemberRequests = membersRequestsApi.useGetById
export const useCreateMemberRequests = membersRequestsApi.useCreate
export const useUpdateMemberRequests = membersRequestsApi.useUpdate
export const useDeleteMemberRequests = membersRequestsApi.useDelete

/**
 * Approve / reject both PUT the same endpoint with a different status. Note
 * the path takes the **member** id, not the request id.
 */
const useChangeStatus = (status: ChangeMemberStatusInput["status"]) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ memberId, note }: { memberId: number | string; note?: string }) => {
      const response = await api.put(`/member_request/change_status/${memberId}`, {
        status,
        note,
      })
      return response.data as MemberRequest
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MemberRequestQueryKeys.all() })
    },
  })
}

export const useApproveMember = () => useChangeStatus("approved")
export const useRejectMember = () => useChangeStatus("rejected")
```

**A custom read with its own nested key:**

`features/branches/api.ts` — full file:

```ts
import { useQuery } from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/api/client"
import type { GetResponse } from "@/types/api"
import { createApiFactory } from "@/utils/api/api-factory"
import type { Branch, CreateBranchInput, UpdateBranchInput } from "./types"

/**
 * Branches. See docs/CRUD-MIGRATION-REFERENCE.md §1.4.
 */
const branchesApi = createApiFactory<Branch, CreateBranchInput, UpdateBranchInput>({
  entityName: "branch",
  endpoint: "/branch",
})

export const BranchQueryKeys = {
  ...branchesApi.QueryKeys,
  /** Nested under `all()`, so a branch mutation refreshes these too. */
  byTemplate: (templateId: string | number) =>
    [...branchesApi.QueryKeys.all(), "template", templateId] as const,
}

export const useGetBranches = branchesApi.useGetList
export const useGetBranch = branchesApi.useGetById
export const useCreateBranch = branchesApi.useCreate
export const useUpdateBranch = branchesApi.useUpdate
export const useDeleteBranch = branchesApi.useDelete

/**
 * `GET /branch/template/{templateId}` — the branches that can issue one
 * template, for the picker on a template that requires a branch.
 *
 * Outside the factory because it is not `/{id}`: the path segment is a
 * *template* id, so `useGetBranch(templateId)` would read a branch whose id
 * happens to match a template's and return the wrong row rather than fail.
 * Returns the whole response, matching `useGetList`.
 */
export function useGetBranchesByTemplateId(
  templateId: string | number | undefined,
) {
  return useQuery<GetResponse<Branch[]>, AxiosError>({
    queryKey: BranchQueryKeys.byTemplate(templateId as string | number),
    queryFn: async () =>
      await api.get<{ data: Branch[] }>(`/branch/template/${templateId}`),
    enabled: !!templateId,
  })
}
```

The custom key `["branch", "template", id]` sits under `["branch"]`, so creating or editing a branch also refreshes these pickers. The hook returns the whole response, like `useGetList`.

**A custom action on one row, keeping the factory's invalidation:**

`features/users/api.ts` — full file:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/api/client"
import { createApiFactory } from "@/utils/api/api-factory"
import type { CreateUserInput, UpdateUserInput, User } from "./types"

/**
 * Platform admins. See docs/CRUD-MIGRATION-REFERENCE.md §1.7.
 *
 * `/user` is the admin table specifically — organization and branch users have
 * their own endpoints. There is no organization concept here at all: an admin
 * is platform-wide, which is why this module has no org selector and no
 * dependent lookups.
 */
const usersApi = createApiFactory<User, CreateUserInput, UpdateUserInput>({
  entityName: "user",
  endpoint: "/user",
})

export const UserQueryKeys = usersApi.QueryKeys

export const useGetUsers = usersApi.useGetList
export const useGetUser = usersApi.useGetById
export const useCreateUser = usersApi.useCreate
export const useUpdateUser = usersApi.useUpdate
export const useDeleteUser = usersApi.useDelete

/**
 * `POST /user/{id}/reset` — clears the user's TOTP secret so they enrol a new
 * authenticator at next login.
 *
 * ### It invalidates the list, unlike the original
 *
 * The app this was ported from fired this call and refreshed nothing
 * (docs/CRUD-MIGRATION-REFERENCE.md §3.7), leaving the table showing
 * "2FA enrolled" for an account that no longer is — the one row on this screen
 * whose whole purpose is to say whether a reset is still needed. Since
 * `tfaEnabled` is a column here, the reset invalidates like every other
 * mutation.
 */
export function useResetUserMfa(options?: {
  onSuccess?: () => void
  onError?: (error: AxiosError) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<void, AxiosError, string | number>({
    mutationFn: async (userId) => {
      await api.post(`/user/${userId}/reset`)
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UserQueryKeys.all() })
      options?.onSuccess?.()
    },
  })
}
```

The same reset hook exists for branch users and organization users ([appendix](#appendix-the-remaining-feature-modules-in-full)).

**Every factory option at once, plus five custom endpoints:**

`features/ids/api.ts` — full file:

```ts
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query"

import api from "@/api/client"
import { createApiFactory, type ApiError } from "@/utils/api/api-factory"
import { serializeQuery } from "@/utils/api/api"
import { objectToFormData } from "@/utils/objects"
import type { BaseQuery, GetResponse, PaginationMeta } from "@/types/api"
import type { RequestOptions } from "@/types/axios"

import {
  statusId,
  type ApproveIdInput,
  type ChangeStatusInput,
  type CreateIDCardInput,
  type IDCard,
  type RejectIdInput,
  type StatusName,
  type UpdateIdVarsInput,
} from "./types"

/**
 * IDs (identities). See docs/api-types.md § ids for every shape, and
 * docs/network-layer.md §7 for the module convention.
 *
 * Three settings on the factory, none of them cosmetic:
 *
 *  - **`isFormData`** — the resource uploads files (the applicant's photo, the
 *    approval attachments), so writes are multipart, which is also why updates
 *    POST with `_method=PUT`.
 *  - **`disableRequestKeyConversion`** — a write's keys are already snake_case
 *    and are the template's own variable names besides. Converting them mangles
 *    both: `template_id` would go out as `template_id` → `template_i_d`, and a
 *    variable called `exp_date` would arrive under a name no template knows.
 *  - **`skipResponseKeyConversion: { request: true }`** — the same names coming
 *    back. Everything else on the row is normal camelCase.
 */

/** Skip config, shared by the factory and the hand-written calls below. */
const SKIP: Record<string, boolean> = { request: true }

/** What the hand-written calls pass so they behave like the factory's. */
const REQUEST_OPTIONS: RequestOptions = {
  skipRequestKeyConversion: true,
  skipResponseKeyConversion: SKIP,
}

const idsApi = createApiFactory<IDCard, CreateIDCardInput>({
  entityName: "identity",
  endpoint: "/identity",
  isFormData: true,
  disableRequestKeyConversion: true,
  skipResponseKeyConversion: SKIP,
})

export const IdQueryKeys = idsApi.QueryKeys

export const useGetIds = idsApi.useGetList
export const useGetId = idsApi.useGetById

/**
 * `POST /identity` — issue a card from a template.
 *
 * The factory's create, typed to `CreateIDCardInput`: one multipart body with
 * the template's variables flat at the root (docs/ISSUE-ID-FORM.md §8). The
 * body is assembled by `buildIssuePayload` in ./issue-form.ts rather than at
 * the call site, so the one place that knows the wire shape is next to the
 * one place that knows which variables a design collects.
 *
 * Invalidates every `["identity"]` query, as every factory write does. The
 * *templates* list is stale too after this — `identitiesCount` moved — and
 * the issue sheet invalidates that itself, because the factory only knows its
 * own resource.
 */
export const useCreateId = idsApi.useCreate

/**
 * `DELETE /identity/{id}` — remove a card outright.
 *
 * Offered from the two ledger screens (Requests and ID Flow), never from the
 * printer or delivery queues: a card that has reached a press is stock, and
 * "delete" there would mean something no endpoint does. The factory's
 * invalidation covers both lists and any open detail at once.
 */
export const useDeleteId = idsApi.useDelete

/**
 * ### Documented but not built
 *
 * The factory's `useUpdate` is not exported: `POST /identity/{id}` is the
 * *variable* edit below, which takes a different body from the factory's.
 *
 *  - `useUpdateIdDates` (`PUT /identity/date/{id}`) — rewriting a card's
 *    issue / expiration dates. The reference client declared it and never
 *    called it from a live screen (docs/IDS-FLOW-EXPORTS-ROUTES.md §7), so it
 *    is named here rather than shipped as a hook nothing exercises.
 */

/**
 * `GET /identity/node` — the approval inbox: cards parked at a node the
 * caller is assigned to (docs/IDS-FLOW-EXPORTS-ROUTES.md §3).
 *
 * ### Scoping comes from the token, not a parameter
 *
 * There is no `node_id` to send. The server reads the caller's
 * `node_ids` off the bearer token and returns whatever is sitting at any of
 * them, across every template whose flow contains those nodes. A user with no
 * nodes gets an empty list whatever they filter on.
 *
 * ### Keyed under `["identity", "node", …]`, deliberately
 *
 * Its own key so it never collides with `GET /identity` for the same filter,
 * *and* under the resource's prefix so every write that invalidates
 * `["identity"]` — approve, reject, delete, a status change — refetches this
 * list too. A card that was just approved leaves the inbox on that refetch.
 *
 * Same envelope as the factory's list: the whole Axios response, rows at
 * `data.data.data`.
 */
export function useGetIdsNode(
  filter: BaseQuery,
  options?: Omit<
    UseQueryOptions<GetResponse<IDCard[]>, ApiError, GetResponse<IDCard[]>>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery({
    queryKey: [...IdQueryKeys.all(), "node", filter] as const,
    queryFn: async (): Promise<GetResponse<IDCard[]>> =>
      await api.get<{ data: IDCard[]; meta: PaginationMeta }>("/identity/node", {
        params: serializeQuery(filter),
        options: REQUEST_OPTIONS,
      }),
    ...options,
  })
}

/**
 * `POST /identity/approve` + `_method=PUT` — advance a card to the next node.
 *
 * Multipart, for the attachments; the PHP method override is what lets a
 * browser send one on an update, since a real `PUT` cannot carry a body of
 * files. `objectToFormData` writes `attachments[0]`, `fields[0][key]` and so
 * on, and `null`/`undefined` members are omitted rather than sent as the
 * strings "null" / "undefined" — so an approval with no files and no fields
 * is exactly `identity_id`, `notes`, `_method`.
 */
export function useApproveId() {
  const queryClient = useQueryClient()

  return useMutation<IDCard, ApiError, ApproveIdInput>({
    mutationFn: async (input) => {
      const body = objectToFormData(input)
      body.append("_method", "PUT")
      const response = await api.post<IDCard>("/identity/approve", body, {
        headers: { "Content-Type": "multipart/form-data" },
        options: REQUEST_OPTIONS,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IdQueryKeys.all() })
    },
  })
}

/**
 * `PUT /identity/reject` — stop the flow at the current node.
 *
 * Plain JSON: the endpoint takes an id and a note, and nothing else about the
 * request survives the trip (see `RejectIdInput`). What the rejection does to
 * `status` is the server's decision; the client never touches `status` from
 * the flow screens.
 */
export function useRejectId() {
  const queryClient = useQueryClient()

  return useMutation<IDCard, ApiError, RejectIdInput>({
    mutationFn: async (input) => {
      const response = await api.put<IDCard>("/identity/reject", input, {
        options: REQUEST_OPTIONS,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IdQueryKeys.all() })
    },
  })
}

/**
 * `POST /identity/{id}` + `_method=PUT` — rewrite one template variable on an
 * issued card (docs/IDS-FLOW-EXPORTS-ROUTES.md §2.4c).
 *
 * The factory's update is not used because the body is not the entity: it is
 * the one variable being changed, verbatim under the template's own key, plus
 * `template_id`, `organization_id` and `identity` (the card's numeric id).
 * Keys go out untouched — `disableRequestKeyConversion` on this resource is
 * what keeps a variable called `exp_date` from arriving as something no
 * template knows.
 */
export function useUpdateIdVars() {
  const queryClient = useQueryClient()

  return useMutation<IDCard, ApiError, { id: number | string; data: UpdateIdVarsInput }>({
    mutationFn: async ({ id, data }) => {
      const body = objectToFormData(data)
      body.append("_method", "PUT")
      const response = await api.post<IDCard>(`/identity/${id}`, body, {
        headers: { "Content-Type": "multipart/form-data" },
        options: REQUEST_OPTIONS,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IdQueryKeys.all() })
    },
  })
}

/**
 * `PUT /identity/change_status/{id}` — move a card along the workflow.
 *
 * Takes the status **name** and converts. The endpoint wants the number, and
 * a call site holding `4` is a call site nobody can read; worse, `0` is a real
 * status, so a mistyped name that fell through to a default would silently
 * send a card back to `PENDING`. An unknown name throws here instead, before
 * a request goes out.
 */
export function useChangeIdStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: number | string
      status: StatusName
      notes?: string
    }): Promise<IDCard> => {
      const numeric = statusId(status)
      if (numeric < 0) throw new Error(`Unknown identity status: ${status}`)

      const body: ChangeStatusInput = { status: numeric, notes }
      const response = await api.put<IDCard>(
        `/identity/change_status/${id}`,
        body,
        { options: REQUEST_OPTIONS }
      )
      return response.data
    },
    // Every list on the screen is keyed under `identity`, so one invalidation
    // refreshes the queue, its counts and any open detail alike.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IdQueryKeys.all() })
    },
  })
}
```

What to learn from this module:

- `SKIP` and `REQUEST_OPTIONS` are defined once, so the factory's calls and the hand-written ones convert the same way.
- `useApproveId` and `useUpdateIdVars` are multipart updates written by hand, so they append `_method=PUT` themselves.
- `useChangeIdStatus` checks its input **before** any request goes out, and throws a plain `Error` (not an `AxiosError`) for an unknown status.
- `useGetIdsNode` uses its own key `["identity", "node", filter]`, under the resource's prefix.

**A sibling resource, and a GET that is really an action:**

`features/templates/api.ts` — full file:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"

import api from "@/api/client"
import { createApiFactory, type ApiError } from "@/utils/api/api-factory"
import type {
  CloneTemplateInput,
  CreateTemplateInput,
  ExportTemplateInput,
  Template,
  TemplateExport,
  UpdateTemplateInput,
} from "./types"

/**
 * Templates. See docs/api-types.md § templates for every shape, and
 * docs/network-layer.md §7 for the module convention.
 *
 * ### JSON, not multipart, even though it carries artwork
 *
 * `front_image` / `back_image` go up as **data URLs inside the JSON body**
 * (docs/photo-editor-spec.md §16.1) rather than as files, so this resource is
 * not on the FormData list and updates use a real `PUT`.
 *
 * ### What `GET /template` actually filters on
 *
 * `page`, `per_page`, `search`, `type` and `organization_id` — verified
 * against docs/identities-api.postman_collection.json, which is the authority
 * for this endpoint's query surface. Nothing else. Sending an invented field
 * name is the silent failure docs/filtering-sorting-pagination.md §6
 * describes: it becomes a real query parameter, raises no error, and leaves
 * the list quietly unfiltered.
 *
 * `type` is the ownership split (`TemplateScope` in ./types.ts):
 * `organization` returns templates owned by an organization — the caller's
 * own for an organization user, everyone's for an admin, who may narrow with
 * `organization_id` — and `global` returns the public catalogue, which has no
 * owner and ignores `organization_id`. See docs/CARD-CREATE-ASSIGN-GALLERY.md.
 *
 * ### Documented but not built
 *
 *  - `usePublicTemplate` (`shareKey`) — a *different host*
 *    (`api.bajat.net/api/public/v1`), so it cannot come from this client at
 *    all. It belongs to the public self-service flow, not the dashboard.
 *  - `useGetTemplateFlow` / `useCreateTemplateFlow` — the node routing an
 *    issued card walks. That is the ID Flow screen's resource.
 *
 * They are named rather than silently missing: an exported hook reads as a
 * supported one.
 */
const templatesApi = createApiFactory<
  Template,
  CreateTemplateInput,
  UpdateTemplateInput
>({
  entityName: "template",
  endpoint: "/template",
})

export const TemplateQueryKeys = templatesApi.QueryKeys

export const useGetTemplates = templatesApi.useGetList
export const useGetTemplate = templatesApi.useGetById
export const useCreateTemplate = templatesApi.useCreate
export const useUpdateTemplate = templatesApi.useUpdate
export const useDeleteTemplate = templatesApi.useDelete

/**
 * `POST /template/clone` — copy a design onto new terms.
 *
 * Hand-written because it is a POST to a *sibling* path with the id in the
 * body, which is not a shape the factory has. The invalidation is the factory's
 * though: a clone adds a row, so every template query is stale.
 */
export const useCloneTemplate = () => {
  const queryClient = useQueryClient()

  return useMutation<Template, ApiError, CloneTemplateInput>({
    mutationFn: async (data) => {
      const response = await api.post<Template>("/template/clone", data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TemplateQueryKeys.all() })
    },
  })
}

/**
 * `PUT /template/{id}/reset` — restart this template's issuance sequences.
 *
 * Empty body; the id is the whole request. Sequences are the counters behind
 * the `incremental` variable type (docs/photo-editor-spec.md §14), so this
 * changes what the *next* card issued is numbered, not any card already cut.
 */
export const useResetTemplateSequences = () => {
  const queryClient = useQueryClient()

  return useMutation<void, ApiError, number>({
    mutationFn: async (id) => {
      await api.put(`/template/${id}/reset`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TemplateQueryKeys.all() })
    },
  })
}

/**
 * `GET /export` — the queue of CSV exports, newest first.
 *
 * ### Its own resource, not a sub-list of templates
 *
 * The path is a sibling of `/template`, and the rows outlive the template they
 * came from: an export that has already run is a file, and deleting the
 * template it was cut from does not un-run it. So it gets its own factory and
 * its own cache namespace rather than a nested key under `["template"]` —
 * which also means editing a template does not invalidate a list of finished
 * files that could not have changed.
 *
 * Read-only, deliberately. Rows are *produced* by `GET
 * /template/export/{templateId}` on the templates screen; nothing on the
 * exports screen creates, retries or deletes one.
 */
const templateExportsApi = createApiFactory<TemplateExport>({
  entityName: "templateExport",
  endpoint: "/export",
})

export const TemplateExportQueryKeys = templateExportsApi.QueryKeys

export const useGetTemplateExports = templateExportsApi.useGetList

/**
 * `GET /template/export/{templateId}` — queue an export job
 * (docs/IDS-FLOW-EXPORTS-ROUTES.md §5.3).
 *
 * ### A mutation wrapping a GET, on purpose
 *
 * The verb is GET but the request is a *trigger*: it enqueues a job on the
 * server and returns at once. Modelling it as a query would let React Query
 * cache it, dedupe it and refetch it on window focus — three more spreadsheets
 * nobody asked for. `useMutation` gives it the semantics it has: fires once,
 * on a click, with a pending state for the button.
 *
 * ### Nothing is downloaded here
 *
 * No `responseType: "blob"`, no `Content-Disposition`. The body is ignored;
 * the output surfaces later as a `TemplateExport` row whose `file` fills in.
 * Which is why this invalidates `["templateExport"]` — the reference client
 * did not, and a fresh job stayed invisible on Export History for up to a
 * minute (spec §9.8). `["template"]` is left alone: nothing on the template
 * row changed.
 */
export const useExportTemplate = () => {
  const queryClient = useQueryClient()

  return useMutation<void, ApiError, ExportTemplateInput>({
    mutationFn: async ({ templateId, statuses }) => {
      await api.get(`/template/export/${templateId}`, {
        // Empty means "all", and the way to say that is no parameter at all.
        params: statuses && statuses.length > 0 ? { statuses } : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TemplateExportQueryKeys.all() })
    },
  })
}
```

- `/export` gets **its own factory and cache tree** (`["templateExport"]`). Editing a template does not touch the export history.
- `useExportTemplate` wraps a `GET` in `useMutation`, because the request *starts a job*. As a query, React Query could cache it, dedupe it and refetch it on window focus, starting the job again.
- `params: { statuses }` goes out as `statuses[]=1&statuses[]=4`. An empty list sends no param at all, which means "all statuses".

**A read whose response needs reshaping:**

`features/template-flow/api.ts` — full file:

```ts
import { useQuery, type UseQueryOptions } from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/api/client"
import type { Node } from "@/features/nodes/types"
import { createApiFactory } from "@/utils/api/api-factory"
import type {
  CreateTemplateFlowInput,
  TemplateFlow,
  TemplateFlowRow,
  UpdateTemplateFlowInput,
} from "./types"

/**
 * Template approval flows. See docs/CRUD-MIGRATION-REFERENCE.md §1.18 and
 * docs/network-layer.md §7 for the module convention.
 *
 * ### The write goes through the factory; the read cannot
 *
 * `POST /template/flow` is an ordinary create, so `useCreate` covers it.
 * `GET /template/flow/{templateId}` is not an ordinary read: the id in the
 * path is the **template's**, not this resource's, and the body is a flat
 * array of join rows rather than one entity. The factory's `useGetById`
 * would hand that array back untouched and every caller would have to know
 * how to unpack it — so the unpacking lives here, once, and the hook returns
 * the thing callers actually want: the nodes, in order.
 *
 * ### Which means the cache key is the template id
 *
 * `useCreate` invalidates `["template-flow"]` wholesale, so a save refreshes
 * the flow it just replaced without the caller naming it. The read below
 * uses the factory's own key shape so it is caught by that invalidation.
 */
const templateFlowApi = createApiFactory<
  { id: string | number },
  CreateTemplateFlowInput,
  UpdateTemplateFlowInput
>({
  entityName: "template-flow",
  endpoint: "/template/flow",
})

export const TemplateFlowQueryKeys = templateFlowApi.QueryKeys

/** `POST /template/flow`. Replaces the chain outright; there is no PUT. */
export const useSaveTemplateFlow = templateFlowApi.useCreate

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object"
}

/** A node arrives either wrapped in a join row or, defensively, on its own. */
function nodeOf(entry: unknown): Node | null {
  if (!isRecord(entry)) return null
  const wrapped = (entry as Partial<TemplateFlowRow>).node
  if (isRecord(wrapped) && typeof wrapped.id === "number") return wrapped as Node
  // A bare node — the shape the docs promised. Accepted so a backend that
  // ever starts sending it does not blank the canvas again.
  if (typeof entry.id === "number" && typeof entry.name === "string") {
    return entry as unknown as Node
  }
  return null
}

/**
 * The chain, in order, out of whatever this endpoint returned.
 *
 * Deliberately forgiving about the envelope. This response has already been
 * documented as one shape and observed as another, and the failure mode when
 * the reader guesses wrong is silent — an empty array reads as "this template
 * has no flow", which is a legitimate state, so nothing errors and the canvas
 * simply comes up blank. Accepting a bare array, a `data` envelope and the
 * documented `nodes` key costs three lines and removes that whole class of
 * bug.
 *
 * Exported so the shape can be tested and so anything else reading this
 * endpoint unpacks it the same way.
 */
export function readFlowNodes(body: unknown): Node[] {
  const rows: unknown[] = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body.data)
      ? body.data
      : isRecord(body) && Array.isArray(body.nodes)
        ? body.nodes
        : []

  return rows
    .map((entry, index) => ({
      node: nodeOf(entry),
      // `sort` is the server's ordering. Position in the array is the
      // tie-break, so a response that omits `sort` entirely still comes back
      // in the order it was sent rather than in an arbitrary one.
      sort: isRecord(entry) && typeof entry.sort === "number" ? entry.sort : index,
      index,
    }))
    .filter((row): row is { node: Node; sort: number; index: number } => !!row.node)
    .sort((a, b) => a.sort - b.sort || a.index - b.index)
    .map((row) => row.node)
}

/**
 * `GET /template/flow/{templateId}` → the chain, in order.
 *
 * The id is the **template's**. `useGetTemplateFlow(7)` fetching template 7's
 * flow is only obvious once you know, which is why this is not just
 * `useGetById` under a different name.
 */
export function useGetTemplateFlow(
  templateId: number | undefined,
  options?: Omit<
    UseQueryOptions<Node[], AxiosError, Node[]>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery({
    queryKey: TemplateFlowQueryKeys.byId(templateId as number),
    queryFn: async (): Promise<Node[]> => {
      const response = await api.get<TemplateFlow>(`/template/flow/${templateId}`)
      return readFlowNodes(response.data)
    },
    enabled: !!templateId,
    ...options,
  })
}
```

`useGetTemplateFlow` uses `TemplateFlowQueryKeys.byId(templateId)`, the factory's own key shape. So `useSaveTemplateFlow`, the factory's `useCreate`, invalidates it automatically after a save.

### Pattern C: no factory

When the resource has no id, no list, or no CRUD, the factory's hooks would all be wrong. Write plain React Query hooks on the shared `api`, with a small key object.

**A singleton with no id:**

`features/webhooks/api.ts` — full file:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/api/client"
import type { UpdateWebhookInput, Webhook } from "./types"

/**
 * The webhook singleton. See docs/CRUD-MIGRATION-REFERENCE.md §1.14.
 *
 * Hand-rolled rather than generated: the CRUD factory addresses rows by id and
 * this resource has none. What it keeps from the factory's contract is the one
 * thing call sites depend on — a write invalidates the read, so the form
 * re-reads what the server actually stored instead of trusting what it sent.
 */

export const WebhookQueryKeys = {
  all: () => ["webhook"] as const,
}

/** `GET /webhook`. Returns the entity unwrapped, like `useGetById` does. */
export function useGetWebhook() {
  return useQuery<Webhook, AxiosError>({
    queryKey: WebhookQueryKeys.all(),
    queryFn: async () => {
      const response = await api.get<Webhook>("/webhook")
      return response.data
    },
  })
}

/**
 * `PUT /webhook`. One endpoint for both create and update — there is nothing
 * to create *into*, so the first save and every later one are the same call.
 */
export function useUpdateWebhook(options?: {
  onSuccess?: () => void
  onError?: (error: AxiosError) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<Webhook, AxiosError, UpdateWebhookInput>({
    mutationFn: async (data) => {
      // `webhookUrl` decamelizes to `webhook_url`, which is the name the
      // endpoint reads. See the note on `UpdateWebhookInput`.
      const response = await api.put<Webhook>("/webhook", data)
      return response.data
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WebhookQueryKeys.all() })
      options?.onSuccess?.()
    },
  })
}
```

**A single read that may arrive wrapped:**

`features/statistics/api.ts` — full file:

```ts
import { useQuery, type UseQueryOptions } from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/api/client"
import type { DashboardStatistics } from "./types"

/**
 * Dashboard statistics. See docs/network-layer.md §7 for the module
 * convention, and `./types.ts` for why every field is optional.
 *
 * ### Not from the factory
 *
 * `createApiFactory` generates a CRUD set around a paginated collection.
 * `/statistics` is a single read of one singleton object — no id, no page, no
 * writes — so the factory's hooks would all be wrong and only `useGetList`
 * would be close. It is a handful of lines by hand and honest about what the
 * endpoint is.
 */

export const StatisticsQueryKeys = {
  all: () => ["statistics"] as const,
}

/**
 * One envelope check, for the same reason `unwrapEntity` exists in the
 * factory: this API returns some payloads bare and some wrapped in `data`,
 * and guessing wrong fails silently — every total reads `undefined`, nothing
 * throws, and the landing page comes up full of zeroes.
 *
 * A wrapper is recognised by what it *lacks*: it carries `data` and none of
 * the statistics' own keys.
 */
function unwrapStatistics(body: unknown): DashboardStatistics {
  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    "data" in body &&
    !("totalIdentities" in body)
  ) {
    return ((body as { data?: DashboardStatistics }).data ?? {}) as DashboardStatistics
  }
  return (body ?? {}) as DashboardStatistics
}

/**
 * `GET /statistics` → the overview payload.
 *
 * `staleTime` is a minute: these are counts across a whole tenant, nobody
 * expects them to the second, and the screen is the app's landing page — it is
 * re-entered constantly by users navigating back from a list, and refetching
 * on every one of those would be pure noise.
 */
export function useGetStatistics(
  options?: Omit<
    UseQueryOptions<DashboardStatistics, AxiosError, DashboardStatistics>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery({
    queryKey: StatisticsQueryKeys.all(),
    queryFn: async (): Promise<DashboardStatistics> => {
      const response = await api.get<unknown>("/statistics")
      return unwrapStatistics(response.data)
    },
    staleTime: 60_000,
    ...options,
  })
}
```

**Auth** follows this pattern too. See [§5](#5-tokens-and-401-utilsapiauth-helpersts-and-the-auth-feature).

---

## 14. Every endpoint, every hook

Paths are relative to `API_BASE_URL`. "Factory" means the hook comes from `createApiFactory`.

| Feature | `entityName` (key root) | Endpoint | Factory config | Exported hooks → request |
| --- | --- | --- | --- | --- |
| [api-keys](features/api-keys/api.ts) | `apiKey` | `/access_key` | — | `useGetApiKeys` `GET /access_key` · `useGetApiKey` `GET /access_key/{id}` · `useCreateApiKey` `POST` · `useUpdateApiKey` `PUT /{id}` · `useDeleteApiKey` `DELETE /{id}` |
| [auth](features/auth/api.ts) | *(none)* | `/auth/*` | no factory | `useSendOTP` `POST /auth/send_otp` · `useLogin` `POST /auth/login` · `useRecaptchaCheck` `GET /auth/recaptcha_check` key `["recaptcha-check"]` · `use2FASetup` `GET /auth/2fa/setup` key `["2fa-setup"]` · `use2FAEnable` `POST /auth/2fa/enable` · `useLogout` `POST /auth/logout` |
| [black-list](features/black-list/api.ts) | `blacklist` | `/blacklist` | — | `useGetBlackLists` · `useGetBlackList` · `useCreateBlackList` · `useDeleteBlackList` (no update: there is no `PUT`) |
| [branch-users](features/branch-users/api.ts) | `branch-user` | `/branch_user` | — | the 5 CRUD hooks (`useGetBranchUsers`…) · `useResetBranchUserMfa` `POST /branch_user/{id}/reset` |
| [branches](features/branches/api.ts) | `branch` | `/branch` | — | the 5 CRUD hooks (`useGetBranches`…) · `useGetBranchesByTemplateId` `GET /branch/template/{templateId}` key `["branch","template",id]` |
| [ids](features/ids/api.ts) | `identity` | `/identity` | `isFormData`, `disableRequestKeyConversion`, `skipResponseKeyConversion: { request: true }` | `useGetIds` · `useGetId` · `useCreateId` `POST` multipart · `useDeleteId` · `useGetIdsNode` `GET /identity/node` key `["identity","node",filter]` · `useApproveId` `POST /identity/approve` + `_method=PUT` · `useRejectId` `PUT /identity/reject` · `useUpdateIdVars` `POST /identity/{id}` + `_method=PUT` · `useChangeIdStatus` `PUT /identity/change_status/{id}` |
| [members](features/members/api.ts) | `member` | `/member` | — | `useGetMembers` · `useGetMember` · `useCreateMember` · `useUpdateMember` · `useDeleteMember` |
| [members-requests](features/members-requests/api.ts) | `member-request` | `/member_request` | `isFormData` | `useGetMembersRequests` (list) · `useGetMemberRequests` (detail) · `useCreateMemberRequests` · `useUpdateMemberRequests` (`POST` + `_method=PUT`) · `useDeleteMemberRequests` · `useApproveMember` / `useRejectMember` `PUT /member_request/change_status/{memberId}` |
| [nodes](features/nodes/api.ts) | `node` | `/node` | — | `useGetNodes` · `useGetNode` · `useCreateNode` · `useUpdateNode` · `useDeleteNode` |
| [organization-users](features/organization-users/api.ts) | `organization-user` | `/organization_user` | — | the 5 CRUD hooks · `useResetOrganizationUserMfa` `POST /organization_user/{id}/reset` |
| [organizations](features/organizations/api.ts) | `organization` | `/organization` | `isFormData` (logo) | `useGetOrganizations` · `useGetOrganization` · `useCreateOrganization` · `useUpdateOrganization` (`POST` + `_method=PUT`) · `useDeleteOrganization` |
| [payments](features/payments/api.ts) | `payment` | `/payment` | — | `useGetPayments` · `useGetPayment` (read-only) |
| [permissions](features/permissions/api.ts) | `permission` | `/permission` | — | `useGetPermissions` (read-only) |
| [roles](features/roles/api.ts) | `role` | `/role` | — | `useGetRoles` · `useGetRole` · `useCreateRole` · `useUpdateRole` · `useDeleteRole` |
| [statistics](features/statistics/api.ts) | `statistics` | `/statistics` | no factory | `useGetStatistics` `GET /statistics`, `staleTime` 60 s |
| [template-flow](features/template-flow/api.ts) | `template-flow` | `/template/flow` | — | `useSaveTemplateFlow` `POST /template/flow` · `useGetTemplateFlow` `GET /template/flow/{templateId}` key `["template-flow", templateId]` |
| [templates](features/templates/api.ts) | `template` | `/template` | — | the 5 CRUD hooks (`useGetTemplates`…) · `useCloneTemplate` `POST /template/clone` · `useResetTemplateSequences` `PUT /template/{id}/reset` · `useExportTemplate` `GET /template/export/{templateId}` (as a mutation) |
| [templates](features/templates/api.ts) (exports) | `templateExport` | `/export` | — | `useGetTemplateExports` `GET /export` |
| [users](features/users/api.ts) | `user` | `/user` | — | the 5 CRUD hooks (`useGetUsers`…) · `useResetUserMfa` `POST /user/{id}/reset` |
| [webhooks](features/webhooks/api.ts) | `webhook` | `/webhook` | no factory | `useGetWebhook` `GET /webhook` · `useUpdateWebhook` `PUT /webhook` |

Outside the dashboard API:

| Route | Where | What |
| --- | --- | --- |
| `GET /api/download-image?url=…&filename=…` | [app/api/download-image/route.ts](app/api/download-image/route.ts) (our own Next.js server) | Fetches a storage image from the server side and returns it from our origin ([§17](#17-images-and-files)) |

---

## 15. Using it from a screen

### 15.1 Reading a paginated, filtered list

The helpers a list screen uses:

`hooks/use-list-query.ts` — full file:

````ts
import * as React from "react"

import { useStickyState } from "@/hooks/use-sticky-state"
import type { BaseQuery, FilterQuery } from "@/types/api"
import { DEFAULT_PAGE_SIZE } from "@/utils/constants"

/**
 * Pagination state for a server-driven list, tied to its filters.
 *
 * Hand it the clause array from `buildFilter` and it hands back the whole
 * `BaseQuery` to pass to a list hook:
 *
 * ```ts
 * const filter = React.useMemo(() => buildFilter({ search, statuses }), [search, statuses])
 * const { query, page, pageSize, setPage, setPageSize } = useListQuery(filter)
 * const rows = useGetMembersRequests(query, { placeholderData: keepPreviousData })
 * ```
 *
 * ### The page resets itself
 *
 * Both of the visible-confusion bugs in
 * docs/filtering-sorting-pagination.md §9 — a filter change and a page-size
 * change each leaving you stranded past the end of a shrunken result set — come
 * from page being remembered across a change that invalidates it. So page is
 * **not** remembered across one: it is stored against a snapshot of the filters
 * and page size, and reads as 1 the moment that snapshot no longer matches.
 *
 * Deriving it rather than correcting it in an effect matters. An effect would
 * render one frame asking for page 5 of a one-page result, fire that request,
 * and only then snap back — a wasted round trip and a flash of an empty table.
 * Every call site is also spared a `setPage(1)` it can forget to write.
 *
 * ### Both survive leaving the screen
 *
 * Given a `storageKey`, the page and the page size are held in
 * `useStickyState`, so opening a row and coming back lands on the page you
 * left at the size you chose.
 *
 * The scope check above is what makes that safe to restore. The stored page
 * carries the scope it was valid for, so it comes back only if the filters
 * and page size rebuilt on mount hash to the same thing — page 4 of a filter
 * set you are no longer looking at reads as page 1, exactly as it does when
 * you change a filter with the screen open.
 */
export function useListQuery(
  filter: FilterQuery[],
  options?: {
    /** Rows per page to start on. Defaults to `DEFAULT_PAGE_SIZE`. */
    pageSize?: number
    /**
     * Remember the page and page size under this key, per tab. Omit and both
     * reset every time the screen is mounted.
     */
    storageKey?: string
  }
): {
  /** Ready to pass straight to a list hook. */
  query: BaseQuery
  page: number
  pageSize: number
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
} {
  const storageKey = options?.storageKey
  const [pageSize, setPageSize] = useStickyState(
    storageKey && `${storageKey}:size`,
    options?.pageSize ?? DEFAULT_PAGE_SIZE
  )

  // What the current page number is valid *for*. Anything that changes which
  // rows land on which page belongs in here.
  const scope = React.useMemo(
    () => JSON.stringify([pageSize, filter]),
    [pageSize, filter]
  )

  const [paged, setPaged] = useStickyState(
    storageKey && `${storageKey}:page`,
    { scope, page: 1 }
  )
  const page = paged.scope === scope ? paged.page : 1

  const setPage = (next: number) => setPaged({ scope, page: Math.max(1, next) })

  const query = React.useMemo<BaseQuery>(
    () => ({ page, pageSize, filter }),
    [page, pageSize, filter]
  )

  return { query, page, pageSize, setPage, setPageSize }
}
````

`hooks/use-debounce.ts` — full file:

```ts
import * as React from "react"

/**
 * The value, held back until it has stopped changing for `delay` ms.
 *
 * Used to keep a text filter's input responsive while the *request* it drives
 * fires only once the typing stops. See
 * docs/filtering-sorting-pagination.md §6.
 *
 * The debounced value is what belongs in a query key — the raw input is not,
 * or every keystroke is a cache entry and a round trip.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}
```

[hooks/use-sticky-state.ts](hooks/use-sticky-state.ts) is `useState` backed by `sessionStorage`. Filters, page and page size come back when you return to the screen. It reads the stored value **during the first render**, not in an effect, so the first request is already the restored one, with no wasted request for the unfiltered list.

The wiring, taken from [members-client.tsx](app/[lang]/members/components/members-client.tsx):

```tsx
// excerpt — members-client.tsx (UI and unrelated state removed)
const LIST_KEY = "bajat-members"
const SEARCH_DEBOUNCE_MS = 300

// 1. What the input shows, and what the server is asked for (debounced).
const [query, setQuery] = useStickyState(`${LIST_KEY}:query`, "")
const search = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS)
const [organizationIds, setOrganizationIds] = useStickyState<string[]>(`${LIST_KEY}:organizationIds`, [])

// 2. Filters → clauses. Empty values dropped, order fixed.
const filter = React.useMemo(
  () => buildFilter({ search, phone, organizationIds, createdAtRange: createdAt ? [toInstant(createdAt)] : undefined }),
  [search, phone, organizationIds, createdAt]
)

// 3. Page state that resets itself when the filters or page size change.
const { query: listQuery, page, pageSize, setPage, setPageSize } =
  useListQuery(filter, { pageSize: DEFAULT_PAGE_SIZE, storageKey: LIST_KEY })

// 4. The request. keepPreviousData keeps the old page visible while the next loads.
const membersQuery = useGetMembers(listQuery, { placeholderData: keepPreviousData })
const data = React.useMemo(() => membersQuery.data?.data.data ?? [], [membersQuery.data])

// 5. Pagination numbers, whichever envelope came back.
const pageInfo = React.useMemo(() => readPageInfo(membersQuery.data?.data), [membersQuery.data])
const { total, perPage } = pageInfo
const lastPage = pageInfo.lastPage ?? (total === undefined ? undefined : Math.max(1, Math.ceil(total / pageSize)))

// 6. A picker's data: a fixed query shared app-wide through the cache.
const ORGANIZATIONS_QUERY = { page: 1, pageSize: 100 } as const // module level
const organizationsQuery = useGetOrganizations(ORGANIZATIONS_QUERY)
```

Why each piece is there:

| Piece | Without it |
| --- | --- |
| `useDebounce` | One request and one cache entry per keystroke |
| `buildFilter` | `?search=` sent for an empty box, and filter order would split the cache |
| `useListQuery` | Changing a filter while on page 5 leaves you past the end of a shorter result |
| `keepPreviousData` | Every new page is a new key, so `data` would be `undefined` while it loads and the table, total and page range would flash empty |
| `readPageInfo` | A dead Next button whenever the server returns a paginator with no `meta` |
| Fixed module-level query objects | Keys are hashed by content, so two screens asking for the same `{ page: 1, pageSize: 100 }` share **one** cached response. A module constant stops the two from drifting apart (`pageSize: 50` on one screen would mean a second request) |

Loading states:

| Field | True when | Use it for |
| --- | --- | --- |
| `isPending` | No data yet for this key (and no placeholder) | The first skeleton |
| `isFetching` | Any request in flight, including background refetches and page changes | A small spinner or "busy" on the pagination |
| `isPlaceholderData` | The rows shown are the previous page's (`keepPreviousData`) | Dimming the stale rows |
| `isError` / `error` | The last attempt failed after its retries | The `LoadFailed` state |

### 15.2 Writing, with server validation errors

From [create-member-dialog.tsx](app/[lang]/members/components/create-member-dialog.tsx):

```tsx
// excerpt — create-member-dialog.tsx
/** Server validation errors are keyed by the WIRE name — map them back. */
const WIRE_NAMES: Record<string, FieldName> = {
  name: "name",
  phone: "phone",
  organization_ids: "organizationIds",
  "organization_ids.0": "organizationIds", // Laravel names the bad array ELEMENT
  organizationIds: "organizationIds",
}

const createMember = useCreateMember({ onSuccess: onCreated }) // the list refreshes by itself

createMember.mutate(
  { name: name.trim(), phone: wirePhone ?? "", organizationIds: [chosenId] }, // → organization_ids on the wire
  {
    onError: (error) => {
      if (!axios.isAxiosError(error)) return
      const body = error.response?.data as ApiErrorBody | undefined // snake_case: never camelized
      const next: Errors = {}
      for (const [key, messages] of Object.entries(body?.errors ?? {})) {
        const field = WIRE_NAMES[key]
        if (field && messages[0]) next[field] = messages[0]
      }
      setErrors(next)
    },
  }
)

// A banner only for errors no field claimed (500, offline, an unmapped 422).
const formError = React.useMemo(() => {
  if (!createMember.isError) return null
  const error = createMember.error
  if (!axios.isAxiosError(error)) return t("common.somethingWentWrong")
  const body = error.response?.data as ApiErrorBody | undefined
  if (Object.keys(body?.errors ?? {}).some((key) => key in WIRE_NAMES)) return null
  return body?.message ?? (error.response ? t("common.serverRejected") : t("common.cannotReachServer"))
}, [createMember.isError, createMember.error, t])

const submitting = createMember.isPending // disable the submit button
```

### 15.3 Update and delete

```tsx
// example
const updateMember = useUpdateMember()
updateMember.mutate(
  { id: member.id, data: { name, phone, organizationIds } }, // PUT /member/7
  { onSuccess: () => setOpen(false) }
)

const deleteMember = useDeleteMember()
deleteMember.mutate(member.id) // DELETE /member/7 — every ["member"] query refreshes
```

`mutate` vs `mutateAsync`: `mutate` returns nothing and reports through callbacks. `mutateAsync` returns a promise that **rejects** on error, so wrap it in `try/catch`, or the rejection is unhandled.

### 15.4 A detail screen

```tsx
// example
const { id } = useParams<{ id: string }>()
const detail = useGetId(id)          // GET /identity/{id}; waits until id exists
if (detail.isPending) return <LoadingRows />
if (detail.isError)
  return <LoadFailed title="Couldn't load this card" error={detail.error} onRetry={() => detail.refetch()} retrying={detail.isFetching} />
const card = detail.data             // IDCard, already unwrapped from { data: … }
```

---

## 16. Errors in detail

Every hook rejects with an `AxiosError` (`ApiError` in the factory). The exceptions are hand-written checks that throw a plain `Error` before any request goes out, such as `useChangeIdStatus` with an unknown status.

| What happened | `error.response` | `error.response.status` | `error.response.data` | Who handles it |
| --- | --- | --- | --- | --- |
| Offline / DNS / CORS / server down | `undefined` | — | — | Screen: "can't reach the server". Queries retry up to 3 times |
| 401 Unauthorized | set | 401 | server's | **The interceptor**: clears storage and redirects if a token existed. The promise still rejects |
| 403 Forbidden | set | 403 | `{ message }` | Screen. Not retried |
| 404 Not Found | set | 404 | `{ message }` | Screen. Not retried |
| 422 Validation | set | 422 | `{ message, errors: { field_name: ["…"] } }` | Screen maps `errors` keys (snake_case) to fields |
| 429 Too Many Requests | set | 429 | `{ message }` | Queries retry with backoff. Mutations don't retry: the sign-in screen shows the server's `message` through `getAuthErrorMessage` |
| 5xx | set | 5xx | maybe HTML | Queries retry up to 3 times, then the screen shows `LoadFailed` |

The steps to read an error, as [features/auth/api.ts](features/auth/api.ts) `getAuthErrorMessage` does:

```ts
if (!isAxiosError(error)) return fallback                     // a plain Error, not from HTTP
if (!error.response) return offlineMessage                    // the request never got an answer
const body = error.response.data as ApiErrorBody | undefined  // snake_case keys
return Object.values(body?.errors ?? {}).flat().find(Boolean) // the first field message…
    ?? body?.message                                          // …or the server's message…
    ?? fallback                                               // …or ours
```

`body.message` is the server's wording and cannot be translated on the client. Our own fallbacks go through `t()`.

`useOnline()` ([hooks/use-online.ts](hooks/use-online.ts)) tells you whether the browser thinks it has a network. Use it to show "you're offline" instead of blaming the server, and to retry when the connection comes back:

`hooks/use-online.ts` — full file:

```ts
import * as React from "react"

/**
 * Whether the browser believes it has a network.
 *
 * `navigator.onLine` is a coarse signal — true means "not definitely
 * offline", never "the server is reachable" — which is exactly the right
 * grain for two things: telling someone their Wi-Fi is off rather than
 * blaming the server, and knowing the moment it comes back so a failed
 * request can be retried without a press. The server snapshot is `true`,
 * so a page never renders as offline before it has hydrated.
 */
export function useOnline() {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => true)
}

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

function getSnapshot() {
  return navigator.onLine
}
```

---

## 17. Images and files

### 17.1 Showing and saving storage images

The API returns image URLs such as `front_image` and `back_image` on a storage host, signed as `http://<ip>:<port>/…`, with no TLS. On the deployed `https` site those are mixed content, and the browser drops them. Saving one under a chosen file name needs a `Content-Disposition` header the storage host does not send. Both problems are solved by fetching the image through our own server.

`utils/download-image.ts` — full file:

```ts
/**
 * Saving the card artwork to disk — the client half of
 * app/api/download-image/route.ts.
 *
 * Every function here goes through the same-origin proxy rather than at the
 * storage host: saving a picture under a chosen name needs a
 * `Content-Disposition` the storage host does not send, and fetching one
 * needs a CORS policy it does not grant. The reference client did both — the
 * ledger through the proxy, the flow page straight at the host, where it
 * failed silently whenever CORS said no (docs/IDS-FLOW-EXPORTS-ROUTES.md
 * §9.12). This is the one path.
 *
 * Showing one is the third case, and it is only sometimes free — see
 * `displayImageSrc`.
 */

/** The proxy URL for a storage URL, with or without a save-as name. */
export function proxiedImageUrl(url: string, filename?: string): string {
  const params = new URLSearchParams({ url })
  if (filename) params.set("filename", filename)
  return `/api/download-image?${params.toString()}`
}

/**
 * The `src` to put in an `<img>` for a URL the API handed back.
 *
 * ### Why a plain-`http` picture cannot be shown from an `https` page
 *
 * The storage host signs its URLs as `http://<ip>:<port>/…` — it has no TLS.
 * On `http://localhost` that is an ordinary image. On the deployed site, which
 * is `https`, it is mixed content: the browser upgrades the request to
 * `https`, the handshake fails, and the `<img>` is dropped without a fallback.
 * The same picture pulled through the proxy is same-origin, so the page sees
 * it — the proxy fetches over plain `http` from the server, where no such
 * rule applies. `https`, `data:` and `blob:` sources are left alone: they load
 * directly, and a proxy hop would only add a function call to each one.
 */
export function displayImageSrc(url: string): string
export function displayImageSrc(url: null | undefined): undefined
export function displayImageSrc(url: string | null | undefined): string | undefined
export function displayImageSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return /^http:\/\//i.test(url) ? proxiedImageUrl(url) : url
}

/**
 * Saves one image as `filename`.
 *
 * An anchor click on the proxy URL: same origin, `attachment` disposition,
 * so the browser writes the file without opening a tab and without a blob
 * held in memory. The anchor is removed after the click — `download` on a
 * same-origin URL is honoured, so there is nothing to revoke.
 */
export function downloadImage(url: string, filename: string): void {
  const anchor = document.createElement("a")
  anchor.href = proxiedImageUrl(url, filename)
  anchor.download = filename
  anchor.rel = "noopener"
  anchor.style.display = "none"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

/**
 * Saves the faces of a card, front first, then back.
 *
 * The pause between the two is not decorative: some browsers coalesce two
 * programmatic downloads fired in the same tick and only the last one lands.
 */
export async function downloadCardFaces({
  front,
  back,
  baseName,
}: {
  front: string | null | undefined
  back: string | null | undefined
  /** The stem — the card's `uniqueKey` — the faces are saved under. */
  baseName: string
}): Promise<void> {
  if (front) downloadImage(front, `${baseName}_front.png`)
  if (front && back) await new Promise((resolve) => setTimeout(resolve, 500))
  if (back) downloadImage(back, `${baseName}_back.png`)
}
```

| Function | Use it for | What it does |
| --- | --- | --- |
| `displayImageSrc(url)` | **Every** `<img src>` that holds an API image URL | `http://` → `/api/download-image?url=…` (inline). `https:`, `data:`, `blob:` pass through. `null` → `undefined` |
| `proxiedImageUrl(url, filename?)` | Building the proxy URL yourself | `/api/download-image?url=…[&filename=…]` |
| `downloadImage(url, filename)` | A "download" button | Clicks a hidden `<a>` pointing at the proxy with `filename`, so the server answers `attachment` |
| `downloadCardFaces({ front, back, baseName })` | Saving both faces of a card | `<baseName>_front.png`, a 500 ms pause, then `<baseName>_back.png` (some browsers merge two downloads started at once) |

```tsx
// example
<img src={displayImageSrc(card.frontImage)} alt="" />
<Button onClick={() => downloadCardFaces({ front: card.frontImage, back: card.backImage, baseName: card.uniqueKey })}>
  Download
</Button>
```

### 17.2 The proxy route

`app/api/download-image/route.ts` — full file:

```ts
import { NextResponse, type NextRequest } from "next/server"

/**
 * `GET /api/download-image?url=<storage URL>&filename=<name>` — a same-origin
 * proxy for the card artwork (docs/IDS-FLOW-EXPORTS-ROUTES.md §2.4d).
 *
 * ### Why the browser cannot just download the picture
 *
 * `front_image` / `back_image` are pre-signed URLs on the storage host. A
 * link to one *opens* it — `<a download>` is ignored cross-origin — and a
 * `fetch` of one is subject to that host's CORS policy, which is not ours to
 * set. So the file is pulled here, on the server, and handed back from this
 * origin with `Content-Disposition: attachment`, which is the one thing that
 * makes every browser save it under the name we choose.
 *
 * ### It is an open proxy unless it is not
 *
 * A route that fetches any URL it is given is a way to make this server
 * request things on the caller's behalf. So the target is checked before a
 * byte moves: `http(s)` only, no embedded credentials, a host on the
 * allowlist below, and no literal loopback / private / link-local address.
 * Redirects are not followed — a 3xx from an allowed host to somewhere else
 * is treated as a failure — and the upstream must say it is an image.
 *
 * ### It also shows the pictures, not only saves them
 *
 * The storage host has no TLS, so its `http://` URLs are mixed content on the
 * deployed `https` site and the browser drops them. `displayImageSrc`
 * (utils/download-image.ts) sends those — and only those — through here with
 * no `filename`, so the response is `inline` and the `<img>` is same-origin.
 *
 * ### No authentication, on purpose
 *
 * The dashboard token never reaches this route; the storage URLs are
 * pre-signed and must be fetchable anonymously, which they are. The caller
 * is not checked either: the worst an anonymous caller can do here is fetch
 * an image they already had the URL to.
 *
 * Excluded from the locale proxy by its matcher (proxy.ts) — `/api/…` is
 * never redirected to `/en/api/…`.
 */

/** Storage hosts the artwork is served from. Extend with the env var below. */
const ALLOWED_HOSTS = new Set([
  "api.bajat.net",
  "identities.g4t.io",
  "82.25.101.56:9000",
  "82.25.101.56:9100",
  ...(process.env.DOWNLOAD_IMAGE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
])

const IMAGE_TYPES = /^image\/(png|jpe?g|webp|gif)(;|$)/i

/** A dotted-quad IPv4 that must never be proxied to. */
function isPrivateIPv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!match) return false
  const [a, b] = [Number(match[1]), Number(match[2])]
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost")) return true
  // IPv6 loopback / unspecified / link-local / unique-local.
  if (host === "[::1]" || host === "::1" || host === "[::]" || host === "::") {
    return true
  }
  if (/^\[?f[cd][0-9a-f]{2}:/i.test(host) || /^\[?fe[89ab][0-9a-f]:/i.test(host)) {
    return true
  }
  return isPrivateIPv4(host)
}

/** A `filename=` that cannot break out of the header it is quoted into. */
function safeFilename(value: string | null): string | null {
  if (!value) return null
  const cleaned = value.replace(/[\r\n"\\/]/g, "_").trim().slice(0, 200)
  return cleaned || null
}

function reject(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")
  if (!raw) return reject("Missing url", 400)

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return reject("Invalid url", 400)
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return reject("URL is not allowed", 400)
  }
  if (target.username || target.password) return reject("URL is not allowed", 400)
  if (isBlockedHost(target.hostname)) return reject("URL is not allowed", 400)
  // `host` carries the port when there is one — the allowlist names ports.
  if (!ALLOWED_HOSTS.has(target.host.toLowerCase())) {
    return reject("URL is not allowed", 400)
  }

  let upstream: Response
  try {
    upstream = await fetch(target, {
      redirect: "manual",
      cache: "no-store",
      headers: { Accept: "image/*" },
    })
  } catch {
    return reject("Upstream unreachable", 502)
  }

  // A redirect from an allowed host is not followed: where it points has not
  // been checked, and following it would be the open-proxy hole in one hop.
  if (!upstream.ok) {
    const status =
      upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502
    return reject("Upstream request failed", status)
  }

  const contentType = upstream.headers.get("content-type") ?? ""
  if (!IMAGE_TYPES.test(contentType)) return reject("Not an image", 415)

  const filename = safeFilename(request.nextUrl.searchParams.get("filename"))

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": filename
        ? `attachment; filename="${filename}"`
        : "inline",
      // The link behind it expires in minutes; the bytes do not.
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  })
}
```

Checks, in order, before anything is fetched:

1. `url` is present and parses as a URL (400 otherwise).
2. The protocol is `http:` or `https:`.
3. There is no `user:pass@` in the URL.
4. The host is not loopback, private or link-local (`localhost`, `127.*`, `10.*`, `192.168.*`, `172.16–31.*`, `169.254.*`, IPv6 `::1`, `fc..`, `fe8.`…).
5. `host:port` is on the allowlist. Add more hosts with the `DOWNLOAD_IMAGE_ALLOWED_HOSTS` env var, comma separated.
6. The upstream fetch does **not follow redirects**, and anything other than 2xx fails.
7. The upstream `Content-Type` must be `image/png|jpeg|webp|gif` (415 otherwise).

The response carries `Content-Disposition` (`attachment; filename="…"` or `inline`), `Cache-Control: public, max-age=86400`, `X-Content-Type-Options: nosniff`, and a CSP that blocks everything.

The route sends **no auth token**, on purpose: the storage URLs are pre-signed. [proxy.ts](proxy.ts) leaves `/api/*` out of its matcher, so this route is never redirected to `/en/api/…`.

### 17.3 Downloading a binary from the API

No hook does this today. When one does, it should look like this:

```ts
// example — features/<feature>/api.ts
export async function downloadMembersTemplate() {
  const response = await api.get<Blob>("/member/excel/download", {
    responseType: "blob", // required: without it the interceptor tries to camelize the bytes
  })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement("a")
  link.href = url
  link.download = "members_template.xlsx"
  link.click()
  URL.revokeObjectURL(url)
}
```

### 17.4 Uploading a file

Either set `isFormData: true` on the factory (every write becomes multipart), or write the mutation yourself:

```ts
// example — features/members/api.ts (useUploadMembers is documented but not built yet)
export function useUploadMembers() {
  const queryClient = useQueryClient()

  return useMutation<unknown, ApiError, UploadMembersInput>({
    mutationFn: async (input) => {
      const body = objectToFormData(input) // file → "file", organization_id → "organization_id"
      const response = await api.post("/member/excel", body, {
        headers: { "Content-Type": "multipart/form-data" }, // the browser adds the boundary
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MemberQueryKeys.all() })
    },
  })
}
```

Templates are different: their artwork goes up as **data URLs inside a JSON body**, so `/template` is not a FormData resource ([features/templates/api.ts](features/templates/api.ts)).

---

## 18. Recipes

### 18.1 A new CRUD resource

```ts
// features/widgets/types.ts — example
export type Widget = {
  id: number
  name: string
  organizationId: number
  createdAt: string
}

export type CreateWidgetInput = {
  name: string
  organizationId: number
} & Record<string, unknown>

export type UpdateWidgetInput = Partial<CreateWidgetInput> & Record<string, unknown>
```

```ts
// features/widgets/api.ts — example
import { createApiFactory } from "@/utils/api/api-factory"
import type { CreateWidgetInput, UpdateWidgetInput, Widget } from "./types"

/** Widgets. Plain JSON on every verb. */
const widgetsApi = createApiFactory<Widget, CreateWidgetInput, UpdateWidgetInput>({
  entityName: "widget",
  endpoint: "/widget",
})

export const WidgetQueryKeys = widgetsApi.QueryKeys

export const useGetWidgets = widgetsApi.useGetList
export const useGetWidget = widgetsApi.useGetById
export const useCreateWidget = widgetsApi.useCreate
export const useUpdateWidget = widgetsApi.useUpdate
export const useDeleteWidget = widgetsApi.useDelete
```

Checklist:

1. Is the API path snake_case (`/branch_user`)? `endpoint` must match it exactly. `entityName` is only a cache key prefix.
2. Does any write upload a `File`? Set `isFormData: true`. Updates then become `POST` + `_method=PUT` automatically.
3. Are the payload keys already snake_case, or names the server must get verbatim? Set `disableRequestKeyConversion: true`.
4. Does a response field hold free-form JSON? Use `skipResponseKeyConversion: { thatField: true }`.
5. No `PUT` or `DELETE` on the server? Don't export those hooks. Name them in a comment.
6. Check every filter param name against the Postman collection.

### 18.2 A custom action endpoint

```ts
// example — added to features/widgets/api.ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/api/client"
import type { ApiError } from "@/utils/api/api-factory"

/** `PUT /widget/{id}/archive`. */
export function useArchiveWidget() {
  const queryClient = useQueryClient()

  return useMutation<Widget, ApiError, number>({
    mutationFn: async (id) => {
      const response = await api.put<Widget>(`/widget/${id}/archive`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WidgetQueryKeys.all() })
    },
  })
}
```

### 18.3 A sub-resource with its own cache entry

```ts
// example
export const WidgetQueryKeys = {
  ...widgetsApi.QueryKeys,
  /** Under all(), so every widget write refreshes it too. */
  history: (id: number) => [...widgetsApi.QueryKeys.byId(id), "history"] as const,
}

export function useGetWidgetHistory(id: number | undefined) {
  return useQuery<GetResponse<WidgetEvent[]>, AxiosError>({
    queryKey: WidgetQueryKeys.history(id as number),
    queryFn: async () => await api.get<{ data: WidgetEvent[] }>(`/widget/${id}/history`),
    enabled: !!id,
  })
}
```

### 18.4 Invalidating another resource after a write

The factory only knows its own resource. If a write changes something else, invalidate that too:

```ts
// example — after issuing a card, the template's identitiesCount moved
const createId = useCreateId({
  onSuccess: () => queryClient.invalidateQueries({ queryKey: TemplateQueryKeys.all() }),
})
```

### 18.5 Calling the API with a different base path

Pass an absolute URL. It skips `baseURL` but **not** the interceptors, so the dashboard token goes with it. Only do this for Bajat hosts:

```ts
// example
await api.post("https://api.bajat.net/api/public/v1/identity", body, {
  options: { skipRequestKeyConversion: true },
})
```

For a third-party host, use `fetch`, not `api`.

### 18.6 Polling

```ts
// example
const q = useGetIdsNode(query, { refetchInterval: 30_000, refetchIntervalInBackground: false })
```

### 18.7 Reshaping data for one screen

The factory types its options as `UseQueryOptions<TData, ApiError, TData>`. The third parameter is what `select` returns, so **`select` cannot change the shape** on factory hooks. Derive the shape with `useMemo` on `query.data` instead. The cache keeps the full response, and every screen reading it is unaffected:

```ts
// example
const organizationsQuery = useGetOrganizations({ page: 1, pageSize: 100 })
const options = React.useMemo(
  () => (organizationsQuery.data?.data.data ?? []).map((o) => ({ key: String(o.id), label: o.name })),
  [organizationsQuery.data]
)
```

---

## 19. Gotchas checklist

- **`useGetList` returns the Axios response.** Rows are at `q.data.data.data`. `useGetById`, `useCreate` and `useUpdate` return the entity, already unwrapped.
- **Pagination numbers go through `readPageInfo(q.data?.data)`.** Never read `meta.total` directly.
- **Error bodies are snake_case.** `error.response.data.errors.organization_ids`, not `organizationIds`.
- **401 is handled for you.** Don't redirect on 401 in screen code.
- **A multipart update is `POST` + `_method=PUT`.** The factory adds it. Hand-written hooks must append it themselves.
- **Binary responses need `responseType: "blob"` or `"arraybuffer"`,** or the interceptor will try to camelize them.
- **Params are always decamelized.** There is no opt-out. Write param names in camelCase or snake_case; both come out snake_case.
- **Keys with capital runs break:** `userID` → `user_i_d`. Write `userId`.
- **Unknown filter names fail without errors.** They become real params, the server ignores them, and the list is unfiltered.
- **`sort` is not sent to the server.** Changing it only changes the cache key.
- **The token is attached to every request `api` sends**, absolute URLs included. Never point `api` at a third-party host.
- **`temp_token` beats the real token.** It must be removed the moment `/auth/2fa/enable` succeeds.
- **`NEXT_PUBLIC_API_BASE_URL` changes need a restart.** It is inlined at build time.
- **An `enabled` you pass to `useGetById` replaces its `!!id` guard.** Write `enabled: !!id && yourCondition`.
- **Mutations are never retried**, and queries are not retried on 4xx (except 408/429).
- **Custom keys start with the factory's** (`[...X.QueryKeys.all(), …]`), or factory writes won't refresh them.
- **`useGetWebhook` returns `response.data` as it came.** It does not use `unwrapEntity`, so if `/webhook` ever wraps its body in `data`, `.url` will read `undefined`.
- **Every `<img>` with an API URL goes through `displayImageSrc`,** or it breaks on the deployed `https` site.

---

## 20. Where docs/network-layer.md is out of date

[docs/network-layer.md](docs/network-layer.md) was written against an earlier version of the code. Where it differs, this file matches the code:

| docs/network-layer.md says | The code now |
| --- | --- |
| `baseURL` is hard-coded to `https://identities.g4t.io/api/dashboard/v1/` | `NEXT_PUBLIC_API_BASE_URL`, falling back to `PROD_API_BASE_URL` = `https://api.bajat.net/api/dashboard/v1/`. `identities.g4t.io` is UAT |
| `handleUnauthorizedResponse` always redirects to `/login` | It redirects only if a token existed, to `/<lang>/login`, and not when already there |
| `getAuthToken` `JSON.parse`s with no guard | A corrupted `auth` entry is treated as signed out |
| Consumers use `hooks/use-datatable.ts`, `getTableProps`, Mantine `DataTable`, `useMutationNotifications` | None of these exist. Screens use `buildFilter` + `useListQuery` + `readPageInfo` + `@tanstack/react-table` ([§15](#15-using-it-from-a-screen)) |
| `onSuccess(data, variables, context)` | `onSuccess(data, variables, onMutateResult, context)`, TanStack Query 5.102 |
| `FilterQuery.value` is `string \| string[]` | `FilterValue`: also `number`, `boolean`, `number[]` |
| `meta` is always present | `meta` is optional; some endpoints return a bare paginator |
| `useApproveId`, `usePublicCreateId`, `useGetMemberIdentities`, `useUploadMembers` examples | `useApproveId` exists (different input). The other three are documented but not built |
| The provider is mounted in `app/(dashboard)/[locale]/layout.tsx` and `app/(minimal)/[locale]/layout.tsx` | It is mounted once, in `app/[lang]/layout.tsx` |

---

## Appendix: the remaining feature modules, in full

The modules not already shown above. All of them follow Pattern A, or Pattern A plus a reset hook.

`features/organizations/api.ts` — full file:

```ts
import { createApiFactory } from "@/utils/api/api-factory"
import type {
  CreateOrganizationInput,
  Organization,
  UpdateOrganizationInput,
} from "./types"

/**
 * Organizations. See docs/CRUD-MIGRATION-REFERENCE.md §1.10 and
 * docs/network-layer.md §7 for the module convention.
 *
 * The tenant every other entity hangs off, which is why this module is read by
 * nearly every screen in the app — the organization pickers on the member,
 * node, branch and black-list forms all come from `useGetOrganizations`.
 *
 * ### Multipart, and the `_method` spoof that comes with it
 *
 * `isFormData` is set because writes carry a `logo` file. The factory then
 * sends updates as `POST /organization/{id}` with `_method=PUT` in the body,
 * since PHP cannot parse a multipart body on a real `PUT`. That is the
 * documented contract for this endpoint, not a workaround this client invented
 * — the Postman collection sends the same field.
 */
const organizationsApi = createApiFactory<
  Organization,
  CreateOrganizationInput,
  UpdateOrganizationInput
>({
  entityName: "organization",
  endpoint: "/organization",
  isFormData: true,
})

export const OrganizationQueryKeys = organizationsApi.QueryKeys

export const useGetOrganizations = organizationsApi.useGetList
export const useGetOrganization = organizationsApi.useGetById
export const useCreateOrganization = organizationsApi.useCreate
export const useUpdateOrganization = organizationsApi.useUpdate
export const useDeleteOrganization = organizationsApi.useDelete
```

`features/branch-users/api.ts` — full file:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/api/client"
import { createApiFactory } from "@/utils/api/api-factory"
import type {
  BranchUser,
  CreateBranchUserInput,
  UpdateBranchUserInput,
} from "./types"

/**
 * Branch users. See docs/CRUD-MIGRATION-REFERENCE.md §1.5.
 */
const branchUsersApi = createApiFactory<
  BranchUser,
  CreateBranchUserInput,
  UpdateBranchUserInput
>({
  entityName: "branch-user",
  endpoint: "/branch_user",
})

export const BranchUserQueryKeys = branchUsersApi.QueryKeys

export const useGetBranchUsers = branchUsersApi.useGetList
export const useGetBranchUser = branchUsersApi.useGetById
export const useCreateBranchUser = branchUsersApi.useCreate
export const useUpdateBranchUser = branchUsersApi.useUpdate
export const useDeleteBranchUser = branchUsersApi.useDelete

/** `POST /branch_user/{id}/reset`. See the note in features/users/api.ts. */
export function useResetBranchUserMfa(options?: {
  onSuccess?: () => void
  onError?: (error: AxiosError) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<void, AxiosError, string | number>({
    mutationFn: async (userId) => {
      await api.post(`/branch_user/${userId}/reset`)
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BranchUserQueryKeys.all() })
      options?.onSuccess?.()
    },
  })
}
```

`features/organization-users/api.ts` — full file:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/api/client"
import { createApiFactory } from "@/utils/api/api-factory"
import type {
  CreateOrganizationUserInput,
  OrganizationUser,
  UpdateOrganizationUserInput,
} from "./types"

/**
 * Organization users. See docs/CRUD-MIGRATION-REFERENCE.md §1.6.
 */
const organizationUsersApi = createApiFactory<
  OrganizationUser,
  CreateOrganizationUserInput,
  UpdateOrganizationUserInput
>({
  entityName: "organization-user",
  endpoint: "/organization_user",
})

export const OrganizationUserQueryKeys = organizationUsersApi.QueryKeys

export const useGetOrganizationUsers = organizationUsersApi.useGetList
export const useGetOrganizationUser = organizationUsersApi.useGetById
export const useCreateOrganizationUser = organizationUsersApi.useCreate
export const useUpdateOrganizationUser = organizationUsersApi.useUpdate
export const useDeleteOrganizationUser = organizationUsersApi.useDelete

/** `POST /organization_user/{id}/reset`. See the note in features/users/api.ts. */
export function useResetOrganizationUserMfa(options?: {
  onSuccess?: () => void
  onError?: (error: AxiosError) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<void, AxiosError, string | number>({
    mutationFn: async (userId) => {
      await api.post(`/organization_user/${userId}/reset`)
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OrganizationUserQueryKeys.all() })
      options?.onSuccess?.()
    },
  })
}
```

`features/roles/api.ts` — full file:

```ts
import { createApiFactory } from "@/utils/api/api-factory"
import type { CreateRoleInput, Role, UpdateRoleInput } from "./types"

/**
 * Roles. See docs/CRUD-MIGRATION-REFERENCE.md §1.8.
 *
 * ### One endpoint, three screens
 *
 * `/role` holds admin, organization and branch roles alike, separated only by
 * `type`. The three screens that edit them (`/management/roles`,
 * `/organizations/roles`, `/branches/roles`) force that field rather than
 * exposing it — a role's scope decides which permissions may be attached to
 * it, so letting it change under an already-checked tree would save a set of
 * permissions the new scope cannot hold.
 *
 * That forcing lives in the screens, not here: this module is the transport,
 * and a hook that silently rewrote `type` would make the other two screens
 * unreachable through it.
 */
const rolesApi = createApiFactory<Role, CreateRoleInput, UpdateRoleInput>({
  entityName: "role",
  endpoint: "/role",
})

export const RoleQueryKeys = rolesApi.QueryKeys

export const useGetRoles = rolesApi.useGetList
export const useGetRole = rolesApi.useGetById
export const useCreateRole = rolesApi.useCreate
export const useUpdateRole = rolesApi.useUpdate
export const useDeleteRole = rolesApi.useDelete
```

`features/permissions/api.ts` — full file:

```ts
import { createApiFactory } from "@/utils/api/api-factory"
import type { Permission } from "@/features/roles/types"

/**
 * Permissions. See docs/CRUD-MIGRATION-REFERENCE.md §1.9.
 *
 * Read-only, and read for exactly one reason: to populate the checkbox tree in
 * the role editor. The list is a fixed vocabulary the backend ships with — it
 * is not user data, nothing creates a permission, and it is always fetched a
 * hundred at a time filtered to one role type.
 */
const permissionsApi = createApiFactory<Permission>({
  entityName: "permission",
  endpoint: "/permission",
})

export const PermissionQueryKeys = permissionsApi.QueryKeys

export const useGetPermissions = permissionsApi.useGetList
```

`features/nodes/api.ts` — full file:

```ts
import { createApiFactory } from "@/utils/api/api-factory"
import type { CreateNodeInput, Node, UpdateNodeInput } from "./types"

/**
 * Workflow nodes. See docs/CRUD-MIGRATION-REFERENCE.md §1.3 and
 * docs/network-layer.md §7 for the module convention.
 *
 * Plain JSON on every verb — nothing here uploads a file, so the `_method=PUT`
 * spoof multipart resources need never comes up and updates are real `PUT`s.
 */
const nodesApi = createApiFactory<Node, CreateNodeInput, UpdateNodeInput>({
  entityName: "node",
  endpoint: "/node",
})

export const NodeQueryKeys = nodesApi.QueryKeys

export const useGetNodes = nodesApi.useGetList
export const useGetNode = nodesApi.useGetById
export const useCreateNode = nodesApi.useCreate
export const useUpdateNode = nodesApi.useUpdate
export const useDeleteNode = nodesApi.useDelete
```

`features/api-keys/api.ts` — full file:

```ts
import { createApiFactory } from "@/utils/api/api-factory"
import type { ApiKey, CreateApiKeyInput, UpdateApiKeyInput } from "./types"

/**
 * API keys. See docs/CRUD-MIGRATION-REFERENCE.md §1.2.
 *
 * `entityName` is camelCase here rather than the endpoint's `access_key`,
 * matching the folder — the key prefix is internal to React Query and nothing
 * else invalidates this resource by hand.
 */
const apiKeysApi = createApiFactory<ApiKey, CreateApiKeyInput, UpdateApiKeyInput>({
  entityName: "apiKey",
  endpoint: "/access_key",
})

export const ApiKeyQueryKeys = apiKeysApi.QueryKeys

export const useGetApiKeys = apiKeysApi.useGetList
export const useGetApiKey = apiKeysApi.useGetById
export const useCreateApiKey = apiKeysApi.useCreate
export const useUpdateApiKey = apiKeysApi.useUpdate
export const useDeleteApiKey = apiKeysApi.useDelete
```

`features/black-list/api.ts` — full file:

```ts
import { createApiFactory } from "@/utils/api/api-factory"
import type { BlackList, CreateBlackListInput } from "./types"

/**
 * Black list. See docs/api-types.md § black-list for every shape, and
 * docs/network-layer.md §7 for the module convention.
 *
 * ### Three hooks, not five
 *
 * The factory generates `useUpdate` as well; it is deliberately **not**
 * re-exported. `/blacklist` has no `PUT` — entries are added and removed, never
 * edited — and an exported hook reads as a supported one. The same reasoning
 * governs `features/organizations`.
 *
 * ### Not multipart
 *
 * Nothing here uploads a file, so writes go out as JSON and the `_method=PUT`
 * spoof PHP needs for multipart bodies never comes up.
 *
 * ### `entityName` is the wire spelling
 *
 * `"blacklist"`, one word, matching the endpoint rather than the `black-list`
 * folder. It is only a React Query key prefix, but keeping it on the endpoint's
 * spelling is what makes a stray `queryClient.invalidateQueries(["blacklist"])`
 * elsewhere hit this resource instead of quietly missing.
 */
const blackListApi = createApiFactory<BlackList, CreateBlackListInput>({
  entityName: "blacklist",
  endpoint: "/blacklist",
})

export const BlackListQueryKeys = blackListApi.QueryKeys

export const useGetBlackLists = blackListApi.useGetList
export const useGetBlackList = blackListApi.useGetById
export const useCreateBlackList = blackListApi.useCreate
export const useDeleteBlackList = blackListApi.useDelete
```

`features/payments/api.ts` — full file:

```ts
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
```

### Feature type files

The entity and input shapes for each module are in its `types.ts`:

| File | Main types |
| --- | --- |
| [features/api-keys/types.ts](features/api-keys/types.ts) | `ApiKey`, `CreateApiKeyInput`, `UpdateApiKeyInput` |
| [features/auth/types.ts](features/auth/types.ts) | `OTPInput`, `LoginInput`, `LoginResponse`, `TwoFactorSetupResponse`, `TotpVerifyInput`, `RecaptchaCheckResponse`, `AuthErrorBody` (shown in §5) |
| [features/black-list/types.ts](features/black-list/types.ts) | `BlackList`, `CreateBlackListInput` |
| [features/branch-users/types.ts](features/branch-users/types.ts) | `BranchUser`, `CreateBranchUserInput`, `UpdateBranchUserInput` |
| [features/branches/types.ts](features/branches/types.ts) | `Branch`, `CreateBranchInput`, `UpdateBranchInput` |
| [features/ids/types.ts](features/ids/types.ts) | `IDCard`, `CreateIDCardInput`, `ApproveIdInput`, `RejectIdInput`, `ChangeStatusInput`, `UpdateIdVarsInput`, `STATUS_NAMES`, `StatusName`, `statusId` |
| [features/members/types.ts](features/members/types.ts) | `Member`, `CreateMembersInput`, `UpdateMembersInput`, `UploadMembersInput` (shown in §8) |
| [features/members-requests/types.ts](features/members-requests/types.ts) | `MemberRequest`, `MemberStatus`, `CreateMembersInput`, `UpdateMembersInput`, `ChangeMemberStatusInput`, `JoinDataInput` (input names collide with members, so import them explicitly) |
| [features/nodes/types.ts](features/nodes/types.ts) | `Node`, `CreateNodeInput`, `UpdateNodeInput` |
| [features/organization-users/types.ts](features/organization-users/types.ts) | `OrganizationUser`, `CreateOrganizationUserInput`, `UpdateOrganizationUserInput` |
| [features/organizations/types.ts](features/organizations/types.ts) | `Organization`, `CreateOrganizationInput`, `UpdateOrganizationInput` |
| [features/payments/types.ts](features/payments/types.ts) | `Payment` |
| [features/roles/types.ts](features/roles/types.ts) | `Role`, `RoleType`, `Permission`, `CreateRoleInput`, `UpdateRoleInput` |
| [features/statistics/types.ts](features/statistics/types.ts) | `DashboardStatistics` (every field optional), plus the chart models built from it in `derive.ts` |
| [features/template-flow/types.ts](features/template-flow/types.ts) | `TemplateFlow`, `TemplateFlowRow`, `CreateTemplateFlowInput`, `UpdateTemplateFlowInput` |
| [features/templates/types.ts](features/templates/types.ts) | `Template`, `TemplateScope`, `CreateTemplateInput`, `UpdateTemplateInput`, `CloneTemplateInput`, `TemplateExport`, `ExportTemplateInput` |
| [features/users/types.ts](features/users/types.ts) | `User`, `CreateUserInput`, `UpdateUserInput` |
| [features/webhooks/types.ts](features/webhooks/types.ts) | `Webhook`, `UpdateWebhookInput` |

For every field of every shape, and the wire spelling of each, see [docs/api-types.md](docs/api-types.md).
