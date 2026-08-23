# Filtering, Sorting & Pagination

How a table's query state is held, turned into request parameters, and sent to the backend — end to end, with the exact code at each step.

**Read this first if you are adding a new list screen.** The whole stack is generic: if you use the standard pieces, a paginated, filterable table needs no new plumbing.

| Concern | File |
| --- | --- |
| Combined table state | [hooks/use-datatable.ts](../hooks/use-datatable.ts) |
| Sort state | [hooks/use-sorting.ts](../hooks/use-sorting.ts) |
| Input debouncing | [hooks/use-debounce.ts](../hooks/use-debounce.ts) |
| Query → request params | [utils/api/api.ts](../utils/api/api.ts) |
| Query contract | [types/api.ts](../types/api.ts) |
| Request dispatch | [utils/api/api-factory.ts](../utils/api/api-factory.ts) |
| Param case conversion | [api/client.ts](../api/client.ts) |
| Page-size constants | [utils/constants.ts](../utils/constants.ts) |
| Filter inputs | [components/filters/](../components/filters/), [components/table-search/](../components/table-search/) |

> ### ⚠️ Sorting does not reach the backend
>
> The sort block in `serializeQuery` is **commented out**, so sort state is tracked, put in the React Query key, and then dropped before the request is built. Changing sort refetches but returns identically-ordered data. Details in [§5](#5-sorting-in-depth).

---

## 1. The pipeline

```
User interaction
      │
      ▼
┌──────────────────────────────────────────────────────────┐
│  Filter input / column header / pagination control       │
│  (debounced for free-text)                               │
└──────────────────────┬───────────────────────────────────┘
                       │ setFilter(field, value) · setPagination · setDtSorting
                       ▼
┌──────────────────────────────────────────────────────────┐
│  useDataTable — three independent state slices           │
│  pagination { page, pageSize }                           │
│  sorting    { field, order }                             │
│  filter     [{ field, value }, …]                        │
└──────────────────────┬───────────────────────────────────┘
                       │ spread into the query hook
                       ▼
┌──────────────────────────────────────────────────────────┐
│  BaseQuery  { page, pageSize, sort, filter, include }    │
└──────────────────────┬───────────────────────────────────┘
                       │ becomes the React Query key → refetch on any change
                       ▼
┌──────────────────────────────────────────────────────────┐
│  serializeQuery()  — flattens to wire params             │
│  page → page · pageSize → per_page                       │
│  filter[] → top-level keys · sort → DROPPED              │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Axios request interceptor — decamelizeKeys(params)      │
│  organizationId → organization_id                        │
└──────────────────────┬───────────────────────────────────┘
                       ▼
              GET /member?page=1&per_page=10&search=ali
```

Every step is generic. Nothing in it knows what a member or an identity is.

---

## 2. The query contract

From [types/api.ts](../types/api.ts):

```ts
export type BaseQuery<
  TSortFields extends readonly string[] = string[],
  TFilterFields extends readonly string[] = string[]
> = {
  pageSize?: number;
  page: number;
  sort?: { field: TSortFields[number]; order: "asc" | "desc" };
  filter?: { field: TFilterFields[number]; value: string | string[] }[];
  include?: string;
};
```

`page` is the only required field. The two generic parameters allow a feature to constrain valid sort and filter field names:

```ts
type MemberQuery = BaseQuery<["name", "createdAt"], ["search", "organizationId"]>;
```

**No feature currently uses them**, so in practice both fall back to `string[]` and field names are unchecked — a typo in a filter field silently produces a parameter the backend ignores.

### Why filters are an array, not an object

```ts
filter?: { field: string; value: string | string[] }[]
```

An object (`{ search: "ali" }`) would be the obvious choice. The array form is used because it keeps **order stable and identity explicit**: filter entries are added and removed by field name without the key-ordering ambiguity that affects object-based React Query keys. It also lets the same field appear more than once if the backend ever needs it — though nothing does that today.

The cost is that reading a value requires a `.find()`, which is why `useDataTable` provides `getFilter()`.

---

## 3. `useDataTable` — the state hub

[hooks/use-datatable.ts](../hooks/use-datatable.ts). One hook holding three independent slices.

```ts
const { pagination, sorting, filter, setFilter, getFilter, getTableProps } =
  useDataTable<Member>();
```

### Signature

```ts
useDataTable<T>({
  pagination?: { page: number; pageSize: number },
  sorting?:    { field: string; order: "asc" | "desc" },
  filter?:     { field: string; value: any }[],
})
```

All three initializers are optional. Defaults: page `1`, pageSize `DEFAULT_PAGE_SIZE` (10), sorting `createdAt desc`, filter `[]`.

Passing an initial filter is how a screen arrives pre-scoped — for example, the identities table reading an organization from the URL:

```ts
useDataTable<IDCard>({
  filter: orgIdParam ? [{ field: "organizationId", value: orgIdParam }] : [],
});
```

### Returned values

| Name | Type | Purpose |
| --- | --- | --- |
| `pagination` | `{ page, pageSize }` | Current page state |
| `setPagination` | `(partial) => void` | Merge-updates (via `useSetState`) |
| `sorting` | `{ field, order }` | Current sort — **for the query key only, see §5** |
| `setSorting` | `(partial) => void` | Direct sort setter |
| `filter` | `{ field, value }[]` | Active filters |
| `setFilter` | `(field, value) => void` | Add / replace / remove one filter |
| `getFilter` | `(field) => any` | Read one filter's value |
| `getTableProps` | `({ query }) => props` | Wires the table to the query result |

### `setFilter` — replace-or-remove

The single most important behavior in this hook:

```ts
const setFilter = (field: string, value: any) => {
  setFilterState((current) => {
    const otherFilters = current.filter((f) => f.field !== field);
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return otherFilters;      // empty → drop the filter entirely
    }
    return [...otherFilters, { field, value }];
  });
};
```

Two consequences worth internalizing:

1. **Setting a filter to an empty value removes it**, rather than sending `search=`. Clearing a search box produces an unfiltered request, not a request for the empty string. `""`, `null`, `undefined`, and `[]` all count as empty.
2. **The field is always replaced, never duplicated.** Calling `setFilter("search", …)` twice leaves one entry.

Note that `0` and `false` are **not** treated as empty — they are legitimate filter values and survive.

> ⚠️ **`setFilter` does not reset the page.** If you are on page 5 and apply a filter that matches three records, the request asks for page 5 of a 1-page result and comes back empty. Reset explicitly where this matters:
>
> ```ts
> onChange={(value) => {
>   setFilter("search", value);
>   setPagination({ page: 1 });
> }}
> ```

### `getTableProps` — binding state to the table

```ts
const query = useGetMembers({
  page: pagination.page,
  pageSize: pagination.pageSize,
  sort: sorting,
  filter: filter,
});

<DataTable {...getTableProps({ query })} columns={…} records={…} />
```

It derives everything the table needs from the query result:

| Prop | Source |
| --- | --- |
| `fetching` | `query.isPending` |
| `totalRecords` | `query.data.data.meta.total` |
| `page` / `onPageChange` | `pagination.page` / `setPagination` |
| `recordsPerPage` / `onRecordsPerPageChange` | `pagination.pageSize` / `setPagination` |
| `recordsPerPageOptions` | `PAGE_SIZE_OPTIONS` |
| `sortStatus` / `onSortStatusChange` | `dtSorting` / `setDtSorting` |
| `minHeight` | `200` when empty, else unset — stops the table collapsing while loading |

Both sections are opt-out:

```ts
getTableProps({ query, isPagination: false, isSorting: false })
```

Note the **double `.data.data`** — that is the paginated envelope described in [api-types.md](./api-types.md#response-envelopes), not a typo.

---

## 4. Pagination

The only one of the three that works end to end.

### State

```ts
const [pagination, setPagination] = useSetState<Pagination>(
  defaultPagination || { page: 1, pageSize: DEFAULT_PAGE_SIZE }
);
```

`useSetState` merges partials, so `setPagination({ page: 2 })` leaves `pageSize` alone.

### Constants

```ts
// utils/constants.ts
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
```

### Serialization

```ts
if (query.page)     params["page"] = query.page;
if (query.pageSize) params["per_page"] = query.pageSize;
```

`pageSize` → `per_page` is a **manual rename**, not the automatic camel→snake conversion. Both are truthy-guarded, so `page: 0` would be omitted — harmless, since pages are 1-indexed.

### Response

```ts
meta: { total: number; currentPage: number; perPage: number }
```

`totalRecords` comes from `meta.total`; the table computes page count from that and `recordsPerPage`.

### Page-size change does not reset the page

Changing page size while on a later page can land you past the end of the resized result set. Neither the hook nor the table corrects this. If it matters:

```ts
onRecordsPerPageChange: (pageSize) => setPagination({ pageSize, page: 1 })
```

---

## 5. Sorting in depth

**Sort state is fully implemented in the client and never sent to the server.**

### The state

[hooks/use-sorting.ts](../hooks/use-sorting.ts) maintains two parallel representations of the same fact:

```ts
// internal — what the query wants
const [sorting, setSorting] = useSetState<Sorting>({
  field: "createdAt",
  order: "desc",
});

// table-facing — what the table component wants
const [dtSorting, setDtSorting] = useSetState<DataTableSortStatus<T>>({
  columnAccessor: "createdAt",
  direction: "desc",
  sortKey: "createdAt",
});
```

`handleSetDtSorting` keeps them synchronized, and is what `getTableProps` exposes as `onSortStatusChange`:

```ts
function handleSetDtSorting(newSorting: DataTableSortStatus<T>) {
  setSorting(() => ({
    field: String(newSorting.sortKey || newSorting.columnAccessor),
    order: newSorting.direction,
  }));
  setDtSorting(() => newSorting);
}
```

`sortKey` takes precedence over `columnAccessor`, which is what lets a column display one field but sort by another — e.g. accessor `organization.name`, sortKey `organization_name`.

### Where it breaks

[utils/api/api.ts](../utils/api/api.ts):

```ts
export const serializeQuery = (query: BaseQuery) => {
  const params = {};
  if (query.page)     params["page"] = query.page;
  if (query.pageSize) params["per_page"] = query.pageSize;

  // if (query.sort) {
  //   params["sort"] = query.sort.field;
  //   params["order"] = query.sort.order;
  // }

  if (query.filter) {
    for (const f of query.filter) params[f.field] = f.value;
  }
  return params;
};
```

The sort block is commented out. So the full chain is:

```
column header clicked
  → handleSetDtSorting updates sorting + dtSorting     ✅
  → sorting is passed as query.sort                    ✅
  → BaseQuery becomes the React Query key              ✅
  → key changed → React Query refetches                ✅
  → serializeQuery drops sort                          ❌
  → request is byte-identical to the previous one
  → same rows, same order, arrow now points the other way
```

The arrow flips and a network request fires, so it *looks* like it is working. The data is unchanged.

### Fixing it

Uncommenting is the whole client-side change:

```ts
if (query.sort) {
  params["sort"] = query.sort.field;
  params["order"] = query.sort.order;
}
```

Two things to check before doing so:

1. **Confirm the backend's expected parameter names.** `sort` + `order` is the guess encoded in the commented code; the API may want `sort_by`/`direction`, or a signed form like `sort=-created_at`.
2. **Confirm the field naming.** `sorting.field` is camelCase (`createdAt`); `decamelizeKeys` converts param *keys*, not *values*, so `sort=createdAt` is sent as-is. If the backend expects `created_at`, convert the value:

```ts
params["sort"] = decamelize(query.sort.field);
```

Given the comment was deliberate, sorting was most likely disabled because the backend contract was unsettled. **Verify against the API before re-enabling** — this doc records the state, not a recommendation to flip it blindly.

---

## 6. Filtering

The part that works, and the most flexible piece.

### Serialization: filters become top-level params

```ts
if (query.filter) {
  for (const f of query.filter) {
    params[f.field] = f.value;
  }
}
```

Each filter is spread as its own query parameter. There is no `filter[…]` bracket syntax and no operator support:

```ts
filter: [
  { field: "search",         value: "ali" },
  { field: "organizationId", value: 3 },
  { field: "statuses",       value: ["PENDING", "PAID"] },
]
```

becomes `?search=ali&organization_id=3&statuses[]=PENDING&statuses[]=PAID` — with `organizationId → organization_id` applied afterward by the interceptor, and arrays serialized by Axios's default `paramsSerializer`.

**Every filter is an implicit equality/match.** Ranges are expressed as dedicated field names (`createdAtRange`, `price`) whose interpretation lives entirely on the backend.

### The filter components

[components/filters/](../components/filters/) — all controlled, all `value`/`onChange` pairs, none owning state:

| Component | Value shape | Used for |
| --- | --- | --- |
| [text-filter.tsx](../components/filters/text-filter.tsx) | `string` | Per-column text match |
| [date-range.tsx](../components/filters/date-range.tsx) | `[Date \| undefined, Date \| undefined]` | Date ranges |
| [number-range.tsx](../components/filters/number-range.tsx) | `{ min, max }` | Numeric ranges |
| [search-select.tsx](../components/filters/search-select.tsx) | `string \| null` | Searchable single-select over a remote list |
| [table-search/](../components/table-search/) | `string` | The main debounced search box |

They take `input`/`setInput` (or `value`/`onChange`) and are wired straight to the hook:

```tsx
<TextFilter
  input={getFilter("memberName")}
  setInput={(value) => setFilter("memberName", value)}
  columnName={t("name")}
/>
```

`getFilter` returns `any`, so consumers cast at the call site:

```tsx
input={getFilter("createdAtRange") as [Date | undefined, Date | undefined] | undefined}
```

### Debouncing

Only `TableSearch` debounces, and it does so internally:

```ts
const [localValue, setLocalValue] = useState(value);
const debouncedValue = useDebounce(localValue, debounceDelay);   // default 500ms

useEffect(() => { setLocalValue(value); }, [value]);             // external → local

useEffect(() => {
  if (debouncedValue !== value) onChange?.(debouncedValue);      // local → external
}, [debouncedValue]);
```

The input stays responsive on `localValue` while `onChange` — and therefore the request — fires only after 500ms of quiet. The `debouncedValue !== value` guard prevents echoing a value that came in from outside back out as a change.

[hooks/use-debounce.ts](../hooks/use-debounce.ts) is the standard timeout-and-cleanup implementation.

> **`TextFilter` and the range filters are not debounced.** They fire on every keystroke or click. That is acceptable for the pop-over column filters, which are used deliberately, but do not reach for `TextFilter` as a primary search box — use `TableSearch`.

### Date range values are sent as `Date` objects

`DateRangeFilter` stores real `Date` instances, and `serializeQuery` passes the value through untouched. So Axios stringifies the array of `Date`s using each one's default serialization.

This works only as long as the backend accepts that format. If you see date filters silently ignored, format at the boundary:

```ts
setInput={(value) =>
  setFilter("createdAtRange", value && [
    value[0] && dayjs(value[0]).format("YYYY-MM-DD"),
    value[1] && dayjs(value[1]).format("YYYY-MM-DD"),
  ])
}
```

### Filter field names are not validated

`params[f.field] = f.value` writes whatever string it is given. A typo — `orgnizationId` — produces a real query parameter that the backend ignores, with **no error anywhere**. The table simply shows unfiltered data. This is the single easiest thing to get silently wrong in the whole stack.

---

## 7. Cache interaction

The assembled `BaseQuery` **is** the React Query cache key:

```ts
const QueryKeys = {
  all:  () => [entityName],
  list: (filter: BaseQuery) => [...QueryKeys.all(), filter],
  byId: (id) => [...QueryKeys.all(), id],
};
```

So:

- **Every state change is a new cache entry.** Page 1 and page 2 are cached separately; going back to page 1 is instant within the 60-second `staleTime`.
- **Returning to a previous filter combination is instant**, because that exact key is still cached.
- **Mutations invalidate `QueryKeys.all()`**, which drops every page and filter combination for that entity at once — the reason the `entityName` prefix matters.
- **Sorting changes still invalidate the key** even though the request is identical — a wasted round trip on every sort click, and the clearest symptom of the §5 bug.

Because the key is the query object, `filter` being an array keeps key generation stable and order-preserving.

---

## 8. Adding a filterable table

```tsx
"use client";

export function ThingsTable() {
  const { pagination, setPagination, sorting, filter, setFilter, getFilter, getTableProps } =
    useDataTable<Thing>();

  const query = useGetThings({
    page: pagination.page,
    pageSize: pagination.pageSize,
    sort: sorting,
    filter: filter,
  });

  return (
    <>
      <TableSearch
        value={getFilter("search")}
        onChange={(value) => {
          setFilter("search", value);
          setPagination({ page: 1 });   // reset — see §3
        }}
      />

      <DataTable
        {...getTableProps({ query })}
        records={query.data?.data?.data ?? []}
        columns={[
          {
            accessor: "name",
            sortable: true,
            filter: (
              <TextFilter
                input={getFilter("name")}
                setInput={(value) => setFilter("name", value)}
              />
            ),
            filtering: !!getFilter("name"),
          },
        ]}
      />
    </>
  );
}
```

Checklist:

- [ ] Reset `page` to 1 wherever a filter changes.
- [ ] Read records from `query.data?.data?.data` — double nesting.
- [ ] Set `filtering: !!getFilter(field)` so the active-filter indicator shows.
- [ ] Confirm each filter field name against the backend — typos fail silently (§6).
- [ ] Debounce free-text via `TableSearch`, not `TextFilter`.
- [ ] Don't expect `sortable: true` to change server-returned order until §5 is resolved.

---

## 9. Known issues

| # | Issue | Impact | Fix |
| --- | --- | --- | --- |
| 1 | **Sort never sent** — block commented out in `serializeQuery` | Sorting appears to work but does nothing; wasted refetch per click | Uncomment after confirming the backend's param names (§5) |
| 2 | **`setFilter` doesn't reset page** | Filtering from a later page can show an empty table | Reset `page: 1` at each call site, or fold it into `setFilter` |
| 3 | **Page-size change doesn't reset page** | Same empty-table symptom | Pass `page: 1` in `onRecordsPerPageChange` |
| 4 | **Filter field names unvalidated** | Typos silently produce unfiltered results | Use `BaseQuery`'s unused generic parameters (§2) |
| 5 | **`getFilter` returns `any`** | No type safety; casts at every call site | Generic `getFilter<T>(field): T` |
| 6 | **Dates sent as `Date` objects** | Depends on Axios's default serialization matching the backend | Format to `YYYY-MM-DD` at the boundary (§6) |
| 7 | **`sorting` and `dtSorting` duplicate state** | Two sources of truth to keep in sync | Derive one from the other |

Items 2 and 3 are the ones that produce visible confusion for users; item 1 is the one most likely to be reported as "sorting is broken."

---

## See also

- [architecture.md](./architecture.md) — where these hooks sit in the layering
- [api-types.md](./api-types.md) — response envelopes and per-endpoint types
- [network-layer.md](./network-layer.md) — interceptors and the CRUD factory
