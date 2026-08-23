# Bajat Dashboard — Network Layer

How data gets in and out of the app: the Axios client, the key-conversion interceptors, the generic API factory, and how features consume (and extend) it.

Everything below lives in a handful of files:

| Concern | File |
| --- | --- |
| Axios instance + interceptors | [api/client.ts](../api/client.ts) |
| CRUD hook generator | [utils/api/api-factory.ts](../utils/api/api-factory.ts) |
| snake_case ⇄ camelCase conversion | [utils/api/key-conversion.ts](../utils/api/key-conversion.ts) |
| Token / 401 handling | [utils/api/auth-helpers.ts](../utils/api/auth-helpers.ts) |
| Query param serialization | [utils/api/api.ts](../utils/api/api.ts) |
| Shared request/response types | [types/api.ts](../types/api.ts) |
| Axios config augmentation | [types/axios.d.ts](../types/axios.d.ts) |
| React Query client config | [providers/react-query-provider.tsx](../providers/react-query-provider.tsx) |

Per-feature API modules live at `features/<feature>/api.ts` — e.g. [features/members/api.ts](../features/members/api.ts), [features/ids/api.ts](../features/ids/api.ts).

---

## 1. Architecture at a glance

```
Component
   │  useGetMembers({ page, pageSize, filter })
   ▼
features/<feature>/api.ts        ← thin: factory instance + custom hooks
   │
   ▼
utils/api/api-factory.ts         ← generic useGetList / useGetById / useCreate / useUpdate / useDelete
   │                               (wraps @tanstack/react-query)
   ▼
api/client.ts (axios instance)
   │  request  interceptor → camelCase → snake_case, params decamelized, Bearer token
   │  response interceptor → snake_case → camelCase, 401 → logout + redirect
   ▼
https://identities.g4t.io/api/dashboard/v1/
```

Two rules follow from this diagram:

- **Components never import `api` for normal CRUD.** They import hooks from `features/<feature>/api.ts`.
- **Feature code always speaks camelCase.** The wire format (snake_case) is an implementation detail of the interceptors.

---

## 2. The Axios client — [api/client.ts](../api/client.ts)

A single shared instance:

```ts
const baseConfig: AxiosRequestConfig = {
  baseURL: "https://identities.g4t.io/api/dashboard/v1/",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
};

const api: AxiosInstance = axios.create(baseConfig);
```

### Request interceptor

Three things happen on every outgoing request:

```ts
api.interceptors.request.use((config) => {
  // 1. body: camelCase → snake_case (FormData-aware)
  if (config.data) {
    config.data = transformRequestKeys(config.data, {
      skipConversion: config?.options?.skipRequestKeyConversion,
      preserveNestedFormDataKeys: config?.options?.preserveNestedFormDataKeys,
    });
  }

  // 2. query params: camelCase → snake_case
  if (config.params) {
    config.params = decamelizeKeys(config.params);
  }

  // 3. Authorization: Bearer <token>
  return addAuthorizationHeader(config);
});
```

### Response interceptor

```ts
api.interceptors.response.use(
  (response) => {
    const isBinaryResponse =
      response.config.responseType === "blob" ||
      response.config.responseType === "arraybuffer";

    if (!isBinaryResponse) {
      response.data = transformResponseKeys(
        response.data,
        response.config?.options?.skipResponseKeyConversion,
      );
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      handleUnauthorizedResponse(); // clears storage, redirects to /login
    }
    return Promise.reject(error);
  },
);
```

Notes:

- **Binary responses are never transformed** — `responseType: "blob" | "arraybuffer"` bypasses key conversion so file downloads stay intact.
- **401 is global.** Any request returning 401 clears `auth` + `temp_token` from `localStorage` and hard-redirects to `/login`. Feature code does not handle 401.

### The custom `options` config field

`options` is not a standard Axios field — it is added by module augmentation in [types/axios.d.ts](../types/axios.d.ts):

```ts
declare module "axios" {
  export interface AxiosRequestConfig {
    options?: {
      skipRequestKeyConversion?: boolean;
      skipResponseKeyConversion?: boolean | Record<string, boolean>;
      preserveNestedFormDataKeys?: boolean;
    };
  }
  // …same for InternalAxiosRequestConfig
}
```

| Option | Effect |
| --- | --- |
| `skipRequestKeyConversion: true` | Send the body exactly as written (keys already snake_case, or a payload the backend must receive verbatim). |
| `skipResponseKeyConversion: true` | Return the raw response body, no camelizing. |
| `skipResponseKeyConversion: { request: true }` | Camelize everything **except** the named top-level properties. Used when a field holds free-form JSON whose keys must not be rewritten (e.g. `identity.request`). |
| `preserveNestedFormDataKeys: true` | For FormData, convert only the root segment of a key path: `joinData[0][fieldName]` → `join_data[0][fieldName]`. |

Usage:

```ts
await api.post("/identity", formData, {
  headers: { "Content-Type": "multipart/form-data" },
  options: { skipRequestKeyConversion: true },
});
```

---

## 3. Auth — [utils/api/auth-helpers.ts](../utils/api/auth-helpers.ts)

The token is read from `localStorage` on every request (not from React state), so it works outside of components too:

```ts
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null; // SSR-safe

  // temp_token wins — it's the short-lived token used during TOTP verification
  const tempToken = localStorage.getItem("temp_token");
  if (tempToken) return tempToken;

  const authStorage = localStorage.getItem("auth"); // written by the zustand persist store
  if (authStorage) {
    const { state } = JSON.parse(authStorage);
    if (state?.token) return state.token;
  }
  return null;
}

export function addAuthorizationHeader(config: InternalAxiosRequestConfig) {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

export function handleUnauthorizedResponse(): void {
  localStorage.removeItem("auth");
  localStorage.removeItem("temp_token");
  window.location.href = "/login";
}
```

`auth` is the persisted [features/auth/store.ts](../features/auth/store.ts) Zustand store (`persist({ name: "auth" })`), which is why the stored shape is `{ state: { token } }`.

---

## 4. Key conversion — [utils/api/key-conversion.ts](../utils/api/key-conversion.ts)

Built on `xcase`'s `camelizeKeys` / `decamelizeKeys`.

**Responses** — `transformResponseKeys(data, skipConfig)`:

- `skipConfig === true` → return as-is.
- `skipConfig` is an object → camelize everything except the listed keys. Handles both a paginated `{ data: { data: [...] } }` array (skipping is applied per row) and a single object.
- otherwise → `camelizeKeys(data)`.

**Requests** — `transformRequestKeys(data, options)`:

- `skipConversion` → return as-is.
- `FormData` → rebuild a new `FormData`, converting each key (the whole key by default, or only the root segment when `preserveNestedFormDataKeys` is set).
- plain object → `decamelizeKeys(data)`.

The root-only converter exists because bracket-notation FormData keys mix a backend field name with app-owned nested keys:

```ts
// "joinData[0][fieldName]" → "join_data[0][fieldName]"
function convertFormDataKeyRootOnly(key: string): string {
  const bracketIndex = key.indexOf("[");
  if (bracketIndex === -1) return toSnakeCase(key);
  return toSnakeCase(key.substring(0, bracketIndex)) + key.substring(bracketIndex);
}
```

---

## 5. Query params — [utils/api/api.ts](../utils/api/api.ts)

List endpoints take a `BaseQuery` ([types/api.ts](../types/api.ts)):

```ts
export type BaseQuery = {
  page: number;
  pageSize?: number;
  sort?: { field: string; order: "asc" | "desc" };
  filter?: { field: string; value: string | string[] }[];
  include?: string;
};
```

`serializeQuery` flattens it into the shape the API expects:

```ts
export const serializeQuery = (query: BaseQuery) => {
  const params: Record<string, string | number | string[]> = {};
  if (query.page) params["page"] = query.page;
  if (query.pageSize) params["per_page"] = query.pageSize;

  if (query.filter) {
    // { field: "search", value: "ali" } → ?search=ali
    for (const f of query.filter) params[f.field] = f.value;
  }
  return params;
};
```

> Sorting is currently commented out in `serializeQuery` — `sort` still travels in the React Query key (so changing it busts the cache), but it is not sent to the server yet.

The paginated response envelope:

```ts
export type GetResponse<T> = {
  data: {
    data: T; // the rows
    meta: { total: number; currentPage: number; perPage: number };
  };
};
```

Note that `useGetList` returns the **whole Axios response**, so rows are at `query.data.data.data` and the total at `query.data.data.meta.total`. That is exactly what [hooks/use-datatable.ts](../hooks/use-datatable.ts) reads.

---

## 6. The API factory — [utils/api/api-factory.ts](../utils/api/api-factory.ts)

`createApiFactory` generates a full CRUD hook set plus a query-key factory for one REST resource.

```ts
export function createApiFactory<
  TEntity extends BaseEntity,        // must have `id`
  TCreateInput extends Record<string, unknown>,
  TUpdateInput extends Record<string, unknown>,
>(config: ApiFactoryConfig)
```

### Config

```ts
export type ApiFactoryConfig = {
  entityName: string;                  // root of the query key, e.g. "member"
  endpoint: string;                    // REST path, e.g. "/member"
  isFormData?: boolean;                // send multipart instead of JSON
  disableRequestKeyConversion?: boolean;
  skipResponseKeyConversion?: boolean | Record<string, boolean>;
  disableMethodKeyForPut?: boolean;
  preserveNestedFormDataKeys?: boolean;
};
```

### What you get back

| Export | Method + URL | Returns |
| --- | --- | --- |
| `QueryKeys` | — | `all()`, `list(filter)`, `byId(id)` |
| `useGetList(filter, options?)` | `GET /endpoint?…` | full response → `GetResponse<TEntity[]>` |
| `useGetById(id, options?)` | `GET /endpoint/:id` | `response.data` → `TEntity` |
| `useCreate(options?)` | `POST /endpoint` | `TEntity` |
| `useUpdate(options?)` | `PUT /endpoint/:id` (or `POST` + `_method=PUT` when `isFormData`) | `TEntity` |
| `useDelete(options?)` | `DELETE /endpoint/:id` | `void` |

Query keys nest, so invalidating `all()` invalidates lists and detail queries alike:

```ts
const QueryKeys = {
  all: () => [entityName],
  list: (filter) => [...QueryKeys.all(), filter],
  byId: (id) => [...QueryKeys.all(), id],
};
```

`useGetById` is guarded with `enabled: !!id`, so it won't fire before an id exists.

**All three mutations invalidate `QueryKeys.all()` on success**, then call any `onSuccess` you passed — so tables refresh themselves without you wiring anything:

```ts
onSuccess: (data, variables, context) => {
  queryClient.invalidateQueries({ queryKey: QueryKeys.all() });
  options?.onSuccess?.(data, variables, context);
},
```

### The FormData / PHP quirk

The backend is PHP, which cannot parse a `multipart/form-data` body on a real `PUT`. So when `isFormData: true`, `useUpdate` posts instead and adds the method override field:

```ts
if (isFormData) {
  headers = { "Content-Type": "multipart/form-data" };
  requestData = objectToFormData(data);
  requestData.append("_method", "PUT"); // PHP method spoofing
}

const response = isFormData
  ? await api.post(`${endpoint}/${id}`, requestData, { headers, options: requestOptions })
  : await api.put(`${endpoint}/${id}`, requestData, { headers, options: requestOptions });
```

`objectToFormData` ([utils/objects.ts](../utils/objects.ts)) flattens nested objects/arrays into bracket notation (`address[city]`, `files[0]`), skips `null`/`undefined`, and passes `File`/`Blob` through untouched.

---

## 7. Defining a feature's API module

The convention: instantiate the factory, re-export the hooks under domain names, then add custom hooks for anything non-CRUD.

### Minimal case — [features/templates/api.ts](../features/templates/api.ts)

```ts
import { createApiFactory } from "@/utils/api/api-factory";
import type { Template, CreateTemplateInput, UpdateTemplateInput } from "./types";

const templatesApi = createApiFactory<Template, CreateTemplateInput, UpdateTemplateInput>({
  entityName: "template",
  endpoint: "/template",
});

export const TemplateQueryKeys = templatesApi.QueryKeys;

export const useGetTemplates = templatesApi.useGetList;
export const useGetTemplate = templatesApi.useGetById;
export const useCreateTemplate = templatesApi.useCreate;
export const useUpdateTemplate = templatesApi.useUpdate;
export const useDeleteTemplate = templatesApi.useDelete;
```

### Configured case — [features/ids/api.ts](../features/ids/api.ts)

```ts
const idsApi = createApiFactory<IDCard, CreateIDCardInput, UpdateIDCardInput>({
  entityName: "identity",
  endpoint: "/identity",
  isFormData: true,                    // cards carry uploaded images
  disableRequestKeyConversion: true,   // payload keys are already snake_case
  skipResponseKeyConversion: {
    request: true,                     // `request` holds free-form field data — don't rewrite its keys
  },
});
```

### Extending query keys

When a feature has sub-resources, spread the factory's keys and add your own — they stay nested under `all()`, so factory mutations still invalidate them:

```ts
export const MemberQueryKeys = {
  ...membersApi.QueryKeys,
  identities: (id: number, filter?: string) => [
    ...membersApi.QueryKeys.byId(id),
    "identities",
    filter,
  ],
  organizations: (id: number, filter?: string) => [
    ...membersApi.QueryKeys.byId(id),
    "organizations",
    filter,
  ],
};
```

### Custom hooks — anything the factory doesn't cover

Custom action endpoints, non-REST verbs, and public (unauthenticated) endpoints are written by hand against `api`. The pattern is always `useMutation` + `invalidateQueries` with the feature's keys.

```ts
// features/ids/api.ts — a custom action endpoint
export const useChangeStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ChangeStatusInput }) => {
      return await api.put(`/identity/change_status/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IdsQueryKeys.all() });
    },
  });
};
```

```ts
// features/ids/api.ts — an approve endpoint that needs FormData + PHP method spoofing
export const useApproveId = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: ApprovedSIdInput) => {
      const formData = objectToFormData(body);
      formData.append("_method", "PUT");
      return await api.post(`/identity/approve`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IdsQueryKeys.all() });
    },
  });
};
```

```ts
// features/ids/api.ts — a public endpoint: an absolute URL overrides baseURL
export const usePublicCreateId = ({ shareKey }: { shareKey: string }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateIDCardInput) => {
      const requestData = objectToFormData({ ...data, share_key: shareKey });
      return await api.post(
        `https://api.bajat.net/api/public/v1/identity`, // different host → passed absolute
        requestData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          options: { skipRequestKeyConversion: true },
        },
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: IdsQueryKeys.all() }),
  });
};
```

```ts
// features/members/api.ts — a custom list endpoint that normalizes an inconsistent response
export const useGetMemberIdentities = (
  memberId: number,
  filter?: string,
  options?: Omit<UseQueryOptions<IDCard[]>, "queryKey" | "queryFn">,
) => {
  return useQuery({
    queryKey: MemberQueryKeys.identities(memberId, filter),
    queryFn: async (): Promise<IDCard[]> => {
      const params: Record<string, string> = {};
      if (filter) params.filter = filter;

      const response = await api.get(`/member/${memberId}/identity`, { params });
      // endpoint sometimes returns a bare array, sometimes { data: [...] }
      return Array.isArray(response.data) ? response.data : response.data?.data || [];
    },
    enabled: !!memberId, // don't fire until we have an id
    ...options,
  });
};
```

```ts
// features/auth/api.ts — auth endpoints are plain hooks, no factory
export const useLogin = () => {
  return useMutation({
    mutationFn: async (data: LoginInput): Promise<LoginResponse> => {
      const response = await api.post("/auth/login", data);
      return response.data;
    },
  });
};
```

---

## 8. Consuming from a component

### Reading a paginated list

[hooks/use-datatable.ts](../hooks/use-datatable.ts) owns pagination/sorting/filter state; you feed that state into the query and hand the query back to `getTableProps`, which reads `data.data.meta.total` and `isPending` for you.

```tsx
"use client";

import { DataTable } from "mantine-datatable";
import { useDataTable } from "@/hooks/use-datatable";
import { useGetMembers, useDeleteMember } from "@/features/members/api";
import { useMutationNotifications } from "@/hooks/use-mutation-notifications";
import { TableSearch } from "@/components/table-search";
import type { Member } from "@/features/members/types";

export function MembersTable() {
  const { notify } = useMutationNotifications();
  const deleteMember = useDeleteMember(notify("delete"));

  const { pagination, sorting, filter, setFilter, getFilter, getTableProps } =
    useDataTable<Member>();

  const query = useGetMembers({
    page: pagination.page,
    pageSize: pagination.pageSize,
    sort: sorting,
    filter: filter, // [{ field: "search", value: "ali" }]
  });

  return (
    <>
      <TableSearch
        value={getFilter("search")}
        onChange={(value) => setFilter("search", value)}
      />

      <DataTable
        {...getTableProps({ query })}
        records={query.data?.data.data ?? []} // ← rows live at data.data.data
        columns={[
          { accessor: "name" },
          { accessor: "phone" },
        ]}
      />
    </>
  );
}
```

Changing `pagination` / `filter` changes the query key, which refetches automatically — there is no manual refetch call.

### Writing (create / update)

`notify("create")` from [hooks/use-mutation-notifications.ts](../hooks/use-mutation-notifications.ts) returns `{ onSuccess, onError }` handlers that show a translated Mantine notification; pass it straight into the hook's options.

```tsx
const { notify } = useMutationNotifications();
const createMember = useCreateMember(notify("create"));
const updateMember = useUpdateMember(notify("update"));

const handleSubmit = form.onSubmit(async (values) => {
  if (selectedRow) {
    await updateMember.mutateAsync({ id: selectedRow.id, data: values });
  } else {
    await createMember.mutateAsync(values);
  }
  close();
});
```

Cache invalidation is already handled inside the factory — don't invalidate manually here.

### Deleting

```tsx
const deleteMember = useDeleteMember(notify("delete"));

modals.openDeleteModal({
  onConfirm: () => deleteMember.mutate(record.id),
});
```

### Downloading a file

For binaries, call `api` directly with `responseType: "arraybuffer"` (which also skips response key conversion):

```tsx
const response = await api.get("/member/excel/download", {
  responseType: "arraybuffer",
});

const blob = new Blob([response.data], {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});

const url = URL.createObjectURL(blob);
const link = document.createElement("a");
link.href = url;
link.download = "members_template.xlsx";
link.click();
URL.revokeObjectURL(url);
```

### Uploading a file

```ts
export const useUploadMembers = (options?) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UploadMembersInput) => {
      const formData = objectToFormData(data);
      const response = await api.post("/member/excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    ...options,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: MemberQueryKeys.all() });
      options?.onSuccess?.(data, variables, context);
    },
  });
};
```

---

## 9. React Query configuration — [providers/react-query-provider.tsx](../providers/react-query-provider.tsx)

Mounted in both root layouts (`app/(dashboard)/[locale]/layout.tsx` and `app/(minimal)/[locale]/layout.tsx`). The `QueryClient` is created inside `useState` so it isn't shared across requests during SSR.

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 min — avoids an immediate refetch after hydration
      retry: (failureCount, error) => {
        const status = error.response?.status;
        if (status >= 400 && status < 500) {
          // client errors aren't worth retrying — except throttling/timeout
          return status === 408 || status === 429 ? failureCount < 3 : false;
        }
        return failureCount < 3;
      },
      // exponential backoff, capped at 30s
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
```

`ReactQueryDevtools` is rendered alongside the provider.

---

## 10. Adding a new resource — checklist

1. **Types** — `features/<feature>/types.ts`: the entity (`{ id, … }`) plus `Create…Input` / `Update…Input`.
2. **API module** — `features/<feature>/api.ts`:
   ```ts
   const fooApi = createApiFactory<Foo, CreateFooInput, UpdateFooInput>({
     entityName: "foo",
     endpoint: "/foo",
   });

   export const FooQueryKeys = fooApi.QueryKeys;
   export const useGetFoos = fooApi.useGetList;
   export const useGetFoo = fooApi.useGetById;
   export const useCreateFoo = fooApi.useCreate;
   export const useUpdateFoo = fooApi.useUpdate;
   export const useDeleteFoo = fooApi.useDelete;
   ```
3. Set `isFormData: true` only if the resource uploads files.
4. Add custom hooks for any non-CRUD endpoints, invalidating `FooQueryKeys.all()` on success.
5. Consume in the component via `useDataTable` + `getTableProps({ query })`, and `notify(...)` for mutations.

### Gotchas

- `useGetList` returns the **whole Axios response**; `useGetById` returns `response.data`. Rows are at `query.data.data.data`.
- Any `PUT` carrying FormData must be sent as `POST` with `_method=PUT`. The factory does this for you; hand-written hooks must do it themselves.
- Reach for `options.skipRequestKeyConversion` when your payload keys are already snake_case — double conversion silently mangles them.
- Don't handle 401 locally; the response interceptor already logs out and redirects.
- Binary requests must set `responseType`, otherwise the response interceptor will try to camelize the bytes.
- The base URL is hardcoded in [api/client.ts](../api/client.ts); public endpoints are called with absolute URLs, which bypass `baseURL` but still pass through both interceptors.
