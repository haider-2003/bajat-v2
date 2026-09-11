# API Types Reference

Every entity the backend returns and every input shape it accepts, grouped by feature, with the endpoint and hook for each.

Source of truth is `features/<domain>/types.ts` and `features/<domain>/api.ts`. If a type here disagrees with the code, the code wins — update this file.

**Base URL:** `https://identities.g4t.io/api/dashboard/v1/` — set in [api/client.ts](../api/client.ts).

**Second host:** two hooks bypass the base URL entirely and call `https://api.bajat.net/api/public/v1/` with an absolute path. These are the unauthenticated public endpoints behind the self-service flow — see [Public API](#public-api--different-host).

---

## How to read this document

### Casing

Types are written in **camelCase because that is what your code sees.** The wire format is snake_case; the Axios interceptors convert in both directions, so `createdAt` here is `created_at` on the wire. See [network-layer.md](./network-layer.md).

Two features opt out of parts of that conversion:

| Feature | Opt-out | Effect |
| --- | --- | --- |
| `ids` | `disableRequestKeyConversion: true` | Request bodies are sent exactly as written — **you must send snake_case yourself** |
| `ids` | `skipResponseKeyConversion: { request: true }` | The `request` field's keys are template variable names, returned verbatim |

### Response envelopes

**List** endpoints (`useGetList`) resolve to a paginated envelope — note the double `data`:

```ts
{
  data: {
    data: T[],
    meta: { total: number; currentPage: number; perPage: number }
  }
}
```

So a list is reached as `response.data.data`, and the count as `response.data.meta.total`.

**Detail** endpoints (`useGetById`) resolve to the entity directly — the factory already unwraps `.data` for you.

### Standard query parameters

Every list endpoint accepts:

```ts
type BaseQuery = {
  page: number;
  pageSize?: number;                                        // sent as per_page
  sort?: { field: string; order: "asc" | "desc" };
  filter?: { field: string; value: string | string[] }[];   // spread as top-level params
  include?: string;
};
```

### Conventions across all entities

- `id` is `number` everywhere except `Customer` (`string`).
- `createdAt` / `updatedAt` are ISO 8601 strings, never `Date` objects.
- **Booleans come back as `boolean` but are sent as `0 | 1`.** `isEnabled: boolean` on the entity, `isEnabled?: number` on the input — this asymmetry is intentional and matches the backend.
- Relations (`organization`, `roles`, `nodes`, …) are usually optional and populated only when the endpoint includes them.
- `?` means the field may be absent; `| null` means it may be present and null. Several fields are both.

---

## Every endpoint at a glance

Every call the frontend makes, grouped by resource. Relative paths resolve against the base URL; the two absolute ones are called on a different host.

| Method | Path | Hook | Returns |
| --- | --- | --- | --- |
| **auth** | | | |
| POST | `/auth/send_otp` | `useSendOTP` | `void` |
| POST | `/auth/login` | `useLogin` | `LoginResponse` |
| GET | `/auth/recaptcha_check` | `useReCaptchaCheck` | `{ recaptchaRequired: boolean }` |
| GET | `/auth/2fa/setup` | `use2FASetup` | `TwoFactorSetupResponse` |
| POST | `/auth/2fa/enable` | `use2FAEnable` | `LoginResponse` |
| POST | `/auth/logout` | `useLogout` | `void` |
| **organization** | | | |
| GET | `/organization` | `useGetOrganizations` | `GetResponse<Organization[]>` |
| GET | `/organization/{id}` | `useGetOrganization` | `Organization` |
| POST | `/organization` | `useCreateOrganization` | `Organization` |
| POST | `/organization/{id}` + `_method=PUT` | `useUpdateOrganization` | `Organization` |
| DELETE | `/organization/{id}` | `useDeleteOrganization` | `void` |
| GET | `/organization/{id}/form` | `useGetApplicationFormByOrgId` | `ApplicationForm` |
| POST | `/organization/form` | `useCreateApplicationForm` | `ApplicationForm` |
| PUT | `/organization/form/{id}` | `useUpdateApplicationForm` | `ApplicationForm` |
| **member** | | | |
| GET | `/member` | `useGetMembers` | `GetResponse<Member[]>` |
| GET | `/member/{id}` | `useGetMember` | `Member` |
| POST | `/member` | `useCreateMember` | `Member` |
| PUT | `/member/{id}` | `useUpdateMember` | `Member` |
| DELETE | `/member/{id}` | `useDeleteMember` | `void` |
| POST | `/member/excel` | `useUploadMembers` | bulk import result |
| GET | `/member/{id}/identity` | `useGetMemberIdentities` | `GetResponse<IDCard[]>` |
| GET | `/member/{id}/organization` | `useGetMemberOrganizations` | `GetResponse<Organization[]>` |
| **member_request** | | | |
| GET | `/member_request` | `useGetMembersRequests` | `GetResponse<MemberRequest[]>` |
| GET | `/member_request/{id}` | `useGetMemberRequests` | `MemberRequest` |
| POST | `/member_request` | `useCreateMemberRequests` | `MemberRequest` |
| POST | `/member_request/{id}` + `_method=PUT` | `useUpdateMemberRequests` | `MemberRequest` |
| DELETE | `/member_request/{id}` | `useDeleteMemberRequests` | `void` |
| PUT | `/member_request/change_status/{id}` | `useApproveMember` / `useRejectMember` | `MemberRequest` |
| **identity** | | | |
| GET | `/identity` | `useGetIds` | `GetResponse<IDCard[]>` |
| GET | `/identity/{id}` | `useGetId` | `IDCard` |
| POST | `/identity` | `useCreateId` | `IDCard` |
| DELETE | `/identity/{id}` | `useDeleteId` | `void` |
| GET | `/identity/node` | `useGetIdsNode` | `GetResponse<IDCard[]>` |
| PUT | `/identity/change_status/{id}` | `useChangeStatus` | `IDCard` |
| POST | `/identity/approve` + `_method=PUT` | `useApproveId` | `IDCard` |
| PUT | `/identity/reject` | `useRejectId` | `IDCard` |
| POST | `/identity/{id}` | `useUpdateIdVars` | `IDCard` |
| PUT | `/identity/date/{id}` | `useUpdateIdDates` | `IDCard` |
| **template** | | | |
| GET | `/template` | `useGetTemplates` | `GetResponse<Template[]>` |
| GET | `/template/{id}` | `useGetTemplate` | `Template` |
| POST | `/template` | `useCreateTemplate` | `Template` |
| PUT | `/template/{id}` | `useUpdateTemplate` | `Template` |
| DELETE | `/template/{id}` | `useDeleteTemplate` | `void` |
| POST | `/template/clone` | `useCloneTemplate` | `Template` |
| GET | `/template/export/{id}` | `useExportTemplateAsCSV` | export payload |
| PUT | `/template/{id}/reset` | `useResetTemplateSequences` | `void` |
| GET | `/export` | `useGetTemplatesExports` | `GetResponse<TemplateExport[]>` |
| GET | `/template/flow/{templateId}` | `useGetTemplateFlow` | `TemplateFlow` |
| POST | `/template/flow` | `useCreateTemplateFlow` | `TemplateFlow` |
| **user** | | | |
| GET | `/user` | `useGetUsers` | `GetResponse<User[]>` |
| GET | `/user/{id}` | `useGetUser` | `User` |
| POST | `/user` | `useCreateUser` | `User` |
| PUT | `/user/{id}` | `useUpdateUser` | `User` |
| DELETE | `/user/{id}` | `useDeleteUser` | `void` |
| POST | `/user/{id}/reset` | `useResetUserMfa` | `void` |
| **organization_user** | | | |
| GET | `/organization_user` | `useGetOrganizationUsers` | `GetResponse<OrganizationUser[]>` |
| GET | `/organization_user/{id}` | `useGetOrganizationUser` | `OrganizationUser` |
| POST | `/organization_user` | `useCreateOrganizationUser` | `OrganizationUser` |
| PUT | `/organization_user/{id}` | `useUpdateOrganizationUser` | `OrganizationUser` |
| DELETE | `/organization_user/{id}` | `useDeleteOrganizationUser` | `void` |
| POST | `/organization_user/{id}/reset` | `useResetOrganizationUserMfa` | `void` |
| **branch_user** | | | |
| GET | `/branch_user` | `useGetBranchUsers` | `GetResponse<BranchUser[]>` |
| GET | `/branch_user/{id}` | `useGetBranchUser` | `BranchUser` |
| POST | `/branch_user` | `useCreateBranchUser` | `BranchUser` |
| PUT | `/branch_user/{id}` | `useUpdateBranchUser` | `BranchUser` |
| DELETE | `/branch_user/{id}` | `useDeleteBranchUser` | `void` |
| POST | `/branch_user/{id}/reset` | `useResetBranchUserMfa` | `void` |
| **branch** | | | |
| GET | `/branch` | `useGetBranches` | `GetResponse<Branch[]>` |
| GET | `/branch/{id}` | `useGetBranch` | `Branch` |
| POST | `/branch` | `useCreateBranch` | `Branch` |
| PUT | `/branch/{id}` | `useUpdateBranch` | `Branch` |
| DELETE | `/branch/{id}` | `useDeleteBranch` | `void` |
| GET | `/branch/template/{templateId}` | `useGetBranchesByTemplateId` | `GetResponse<Branch[]>` |
| **node** | | | |
| GET | `/node` | `useGetNodes` | `GetResponse<Node[]>` |
| GET | `/node/{id}` | `useGetNode` | `Node` |
| POST | `/node` | `useCreateNode` | `Node` |
| PUT | `/node/{id}` | `useUpdateNode` | `Node` |
| DELETE | `/node/{id}` | `useDeleteNode` | `void` |
| **role / permission** | | | |
| GET | `/role` | `useGetRoles` | `GetResponse<Role[]>` |
| GET | `/role/{id}` | `useGetRole` | `Role` |
| POST | `/role` | `useCreateRole` | `Role` |
| PUT | `/role/{id}` | `useUpdateRole` | `Role` |
| DELETE | `/role/{id}` | `useDeleteRole` | `void` |
| GET | `/permission` | `useGetPermissions` | `GetResponse<Permission[]>` |
| **access_key** | | | |
| GET | `/access_key` | `useGetApiKeys` | `GetResponse<ApiKey[]>` |
| GET | `/access_key/{id}` | `useGetApiKey` | `ApiKey` |
| POST | `/access_key` | `useCreateApiKey` | `ApiKey` |
| POST | `/access_key/{id}` + `_method=PUT` | `useUpdateApiKey` | `ApiKey` |
| DELETE | `/access_key/{id}` | `useDeleteApiKey` | `void` |
| **blacklist** | | | |
| GET | `/blacklist` | `useGetBlackLists` | `GetResponse<BlackList[]>` |
| GET | `/blacklist/{id}` | `useGetBlackList` | `BlackList` |
| POST | `/blacklist` | `useCreateBlackList` | `BlackList` |
| DELETE | `/blacklist/{id}` | `useDeleteBlackList` | `void` |
| **form** | | | |
| GET | `/form` | `useGetForms` | `GetResponse<FormTemplate[]>` |
| GET | `/form/{id}` | `useGetForm` | `FormTemplate` |
| POST | `/form` | `useCreateForm` | `FormTemplate` |
| PUT | `/form/{id}` | `useUpdateForm` | `FormTemplate` |
| DELETE | `/form/{id}` | `useDeleteForm` | `void` |
| **customers** | | | |
| GET | `/customers` | `useGetCustomers` | `GetResponse<Customer[]>` |
| GET | `/customers/{id}` | `useGetCustomer` | `Customer` |
| POST | `/customers` | `useCreateCustomer` | `Customer` |
| PUT | `/customers/{id}` | `useUpdateCustomer` | `Customer` |
| DELETE | `/customers/{id}` | `useDeleteCustomer` | `void` |
| **singletons / read-only** | | | |
| GET | `/payment` | `useGetPayments` | `GetResponse<Payment[]>` |
| GET | `/payment/{id}` | `useGetPayment` | `Payment` |
| GET | `/statistics` | `useGetStatistics` | `DashboardtatisticResponse` |
| GET | `/webhook` | `useGetWebhookQuery` | `Webhook` |
| PUT | `/webhook` | `useUpdateCreateWebhook` | `Webhook` |
| **public API — different host** | | | |
| GET | `https://api.bajat.net/api/public/v1/template/{shareKey}` | `usePublicTemplate` | `Template` |
| POST | `https://api.bajat.net/api/public/v1/identity` | `usePublicCreateId` | `IDCard` |
| **local Next.js route** | | | |
| GET | `/api/download-image?url=` | none — called as a plain URL | image bytes |

---

## Public API — different host

**Base:** `https://api.bajat.net/api/public/v1/` — **not** the dashboard base URL.

Two hooks pass an absolute URL to Axios, which overrides `baseURL` entirely. They serve the unauthenticated self-service flow, where an applicant opens a shared template link and submits an ID request without a dashboard account.

| Method | Path | Hook | Returns |
| --- | --- | --- | --- |
| GET | `https://api.bajat.net/api/public/v1/template/{shareKey}` | `usePublicTemplate({ shareKey })` | `Template` |
| POST | `https://api.bajat.net/api/public/v1/identity` | `usePublicCreateId({ shareKey })` | `IDCard` |

The `shareKey` comes from `Template.shareKey`; it is the capability token that identifies which template is being filled in.

`usePublicCreateId` sends `multipart/form-data` with `skipRequestKeyConversion: true` and appends `share_key` to the body — so, as with the rest of the `ids` feature, **write your keys in snake_case**.

Three things to know about these two calls:

1. **The host is hard-coded at the call site**, not in [api/client.ts](../api/client.ts) and not in an environment variable. Pointing the app at a different environment requires editing [features/templates/api.ts](../features/templates/api.ts) and [features/ids/api.ts](../features/ids/api.ts) directly.
2. **They still pass through the shared Axios instance**, so the request interceptor attaches an `Authorization` header if a token happens to be in storage — even though these endpoints are meant to be unauthenticated.
3. **The 401 interceptor still applies.** A 401 from this host clears the session and redirects to `/login`, which is the wrong outcome on a public page where no one is logged in.

---

## Quick index

| Feature | Entity | Endpoint | FormData |
| --- | --- | --- | --- |
| [api-keys](#api-keys) | `ApiKey` | `/access_key` | |
| [application-form](#application-form) | `ApplicationForm` | `/organization/form` | |
| [auth](#auth) | `LoginResponse` | `/auth/*` | |
| [black-list](#black-list) | `BlackList` | `/blacklist` | |
| [branch-users](#branch-users) | `BranchUser` | `/branch_user` | |
| [branches](#branches) | `Branch` | `/branch` | |
| [customers](#customers) | `Customer` | `/customers` | |
| [form-template](#form-template) | `FormTemplate` | `/form` | |
| [ids](#ids-identities) | `IDCard` | `/identity` | ✔ |
| [members](#members) | `Member` | `/member` | |
| [members-requests](#members-requests) | `MemberRequest` | `/member_request` | ✔ |
| [nodes](#nodes) | `Node`, `NodeHistory` | `/node` | |
| [organization-users](#organization-users) | `OrganizationUser` | `/organization_user` | |
| [organizations](#organizations) | `Organization` | `/organization` | ✔ |
| [payments](#payments) | `Payment` | `/payment` | |
| [permissions](#permissions) | `Permission` | `/permission` | |
| [roles](#roles) | `Role` | `/role` | |
| [statistic](#statistic) | `DashboardtatisticResponse` | `/statistics` | |
| [template-flow](#template-flow) | `TemplateFlow` | `/template/flow` | |
| [templates](#templates) | `Template`, `TemplateExport` | `/template` | |
| [users](#users) | `User` | `/user` | |
| [webhooks](#webhooks) | `Webhook` | `/webhook` | |

---

## organizations

**Endpoint:** `/organization` · **FormData:** yes (logo upload) · [types](../features/organizations/types.ts) · [api](../features/organizations/api.ts)

The tenant. Referenced by nearly every other entity.

```ts
export type Organization = {
  id: number;
  name: string;
  description: string;
  logo?: string;
  website?: string;
  isEnabled: boolean;
  isJoinRequestsEnabled: boolean;   // gates the public self-service join flow
  createdAt: string;
  updatedAt: string;
  lat?: string;                     // string, not number
  lng?: string;
};

export type CreateOrganizationsInput = {
  name: string;
  description: string;
  logo?: File;                      // File on input, URL string on output
  website?: string;
  isEnabled?: number;               // 0 | 1
  isJoinRequestsEnabled?: number;   // 0 | 1
  lat?: string;
  lng?: string;
};

export type UpdateOrganizationsInput = {
  name?: string;
  description?: string;
  logo?: File;
  website?: string;
  isEnabled?: number;
  isJoinRequestsEnabled?: number;
  lat?: string;
  lng?: string;
};
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetOrganizations(filter)` | GET | `/organization` | `GetResponse<Organization[]>` |
| `useGetOrganization(id)` | GET | `/organization/{id}` | `Organization` |
| `useCreateOrganization()` | POST | `/organization` | `Organization` |
| `useUpdateOrganization()` | POST + `_method=PUT` | `/organization/{id}` | `Organization` |
| `useDeleteOrganization()` | DELETE | `/organization/{id}` | `void` |

> Coordinates are **strings**, not numbers — parse before doing math with them.

---

## members

**Endpoint:** `/member` · [types](../features/members/types.ts) · [api](../features/members/api.ts)

A person who can receive ID cards. Belongs to many organizations.

```ts
export type Member = {
  id: number;
  phone: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  avatar?: string;
  joinDate?: string | null;
  organizations: Organization[];    // plural — always present
};

export type CreateMembersInput = {
  phone: string;
  name: string;
  organizationIds?: string[];       // plural array — `organization_ids` on the wire
};

export type UpdateMembersInput = {
  phone?: string;
  name: string;                     // required on update
  organizationIds?: string[];
};

export type UploadMembersInput = {
  file: File;                       // Excel
  organization_id?: number;         // snake_case in this input
};
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetMembers(filter)` | GET | `/member` | `GetResponse<Member[]>` |
| `useGetMember(id)` | GET | `/member/{id}` | `Member` |
| `useCreateMember()` | POST | `/member` | `Member` |
| `useUpdateMember()` | PUT | `/member/{id}` | `Member` |
| `useDeleteMember()` | DELETE | `/member/{id}` | `void` |
| `useUploadMembers()` | POST | `/member/excel` | bulk import result |
| `useGetMemberIdentities(id, filter)` | GET | `/member/{id}/identity` | `GetResponse<IDCard[]>` |
| `useGetMemberOrganizations(id, filter)` | GET | `/member/{id}/organization` | `GetResponse<Organization[]>` |

> `Member.organizations` is an **array** (many-to-many). Most other entities carry a single `organization`.
>
> The write inputs match: `organizationIds` is a **plural array of strings**, decamelized to `organization_ids`. Sending a singular `organization_id` fails with *"The organization ids field is required."* — members-requests is the one that takes a singular `organizationId`.

---

## members-requests

**Endpoint:** `/member_request` · **FormData:** yes · [types](../features/members-requests/types.ts) · [api](../features/members-requests/api.ts)

A pending application to join an organization. Approving one produces a `Member`.

```ts
interface joinDataInputs extends ApplicationFormInput {
  InputValue?: string | string[];   // the answer; array for multi-select
}

export type MemberRequest = {
  id: number;
  phone: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  avatar?: string;
  joinDate?: string | null;
  joinData?: joinDataInputs[];      // submitted answers to the org's join form
  status: MemberStatus;
  organization: Organization;       // required here, optional on most entities
  memberId?: number | string | null;  // set once approved
  attachment?: string | null;
  note?: string | null;             // rejection reason
};

export type MemberStatus = "pending" | "rejected" | "approved";

export type CreateMembersInput = {
  phone: string;
  name: string;
  organizationId?: string;          // string here, number in members
  joinData?: joinDataInputs[];
};

export type UpdateMembersInput = {
  name: string;
};

export type UploadMembersInput = {
  file: File;
  organization_id?: number;
};
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetMembersRequests(filter)` | GET | `/member_request` | `GetResponse<MemberRequest[]>` |
| `useGetMemberRequests(id)` | GET | `/member_request/{id}` | `MemberRequest` |
| `useCreateMemberRequests()` | POST | `/member_request` | `MemberRequest` |
| `useUpdateMemberRequests()` | POST + `_method=PUT` | `/member_request/{id}` | `MemberRequest` |
| `useDeleteMemberRequests()` | DELETE | `/member_request/{id}` | `void` |
| `useApproveMember()` | PUT | `/member_request/change_status/{memberId}` | `MemberRequest` |
| `useRejectMember()` | PUT | `/member_request/change_status/{memberId}` | `MemberRequest` |

> Two gotchas: `organizationId` is a **singular string** here but a plural `organizationIds: string[]` in `members`; and the input type names (`CreateMembersInput`) collide with the `members` feature — import them explicitly, don't rely on the name.

---

## ids (identities)

**Endpoint:** `/identity` · **FormData:** yes · **Key conversion disabled** · [types](../features/ids/types.ts) · [api](../features/ids/api.ts)

The issued ID card. The system's central entity.

```ts
export type IDCard = {
  id: number;
  name: string;
  phone: string;
  frontImage: string | null;        // rendered card, null until generated
  backImage: string | null;
  uniqueKey: string;                // QR verification key
  status: StatusName;
  request: Record<string, unknown>; // variable values — keys NOT case-converted
  template_id: number;              // snake_case on the entity itself
  createdAt: string;
  updatedAt: string;
  template: Template;
  member?: Member;
  organization?: Organization;
  nodeHistory: NodeHistory[];       // approval trail
};

export type StatusName =
  | "PENDING"               // 0
  | "PAID"                  // 1
  | "APPROVED"              // 2
  | "REJECTED"              // 3
  | "WAITING_TO_PRINT"      // 4
  | "PRINTING"              // 5
  | "PRINTED"               // 6
  | "DELIVERY_IN_PROGRESS"  // 7
  | "DELIVERED"             // 8
  | "RETURNED";             // 9

export type ChangeStatusInput = {
  status: number;                   // the numeric id, NOT the name
  notes?: string;
};

export type CreateIDCardInput = {
  name: string;
  phone: string;
  identity: string;
  template_id?: number;
  [key: string]: any;               // dynamic template variables
};

export type UpdateIDCardInput = {
  name: string;
  phone: string;
  identity: Record<string, unknown>;
  template_id: number;
};

export type ApprovedSIdInput = {
  identity_id: string;
  notes: string;
  attachments: File[];
  fields?: { key: string; value: string }[];
};

export type UpdateIdVars = Record<string, unknown>;
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetIds(filter)` | GET | `/identity` | `GetResponse<IDCard[]>` |
| `useGetId(id)` | GET | `/identity/{id}` | `IDCard` |
| `useCreateId()` | POST | `/identity` | `IDCard` |
| `useDeleteId()` | DELETE | `/identity/{id}` | `void` |
| `useGetIdsNode(filter)` | GET | `/identity/node` | `GetResponse<IDCard[]>` |
| `useChangeStatus()` | PUT | `/identity/change_status/{id}` | `IDCard` |
| `useApproveId()` | POST | `/identity/approve` | `IDCard` |
| `useRejectId()` | PUT | `/identity/reject` | `IDCard` |
| `useUpdateIdVars()` | POST | `/identity/{id}` | `IDCard` |
| `useUpdateIdDates()` | PUT | `/identity/date/{id}` | `IDCard` |
| `usePublicCreateId({ shareKey })` | POST | `https://api.bajat.net/api/public/v1/identity` ⚠️ | `IDCard` |

**This feature has three traps:**

1. **`status` reads as a name, writes as a number.** You receive `"APPROVED"` but must send `2`. Map via the `status` array exported from the types file.
2. **Request keys are not converted.** `disableRequestKeyConversion: true` means you send snake_case yourself — `template_id`, not `templateId`.
3. **`request` keys are not converted on the way back either.** They are template variable names and are returned exactly as the template defined them.

`CreateIDCardInput` has an index signature, so it accepts arbitrary template variables — at the cost of no type checking on those keys.

### What live `GET /identity` rows actually carry

The block above describes the entity; the list endpoint sends a thinner, wider version of it, and [features/ids/types.ts](../features/ids/types.ts) follows the rows rather than the doc:

- **No top-level `name` or `phone`.** The cardholder is in `member` (when the card belongs to a registered member) and again inside `request`, under whichever variable the template's author named it. `identityName` / `identityPhone` in [features/ids/fields.ts](../features/ids/fields.ts) are how a screen reads them — a column that reads `card.name` renders dashes over rows that plainly have names.
- **No `nodeHistory` and no `template_id`.** The embedded `template` object is there instead.
- **Extra relations:** `organization`, `member`, and `creatable` — who issued it, `null` when it came in through the public link — plus `source` (`"INTERNAL"`) and `type`.
- **`frontImage` / `backImage` are pre-signed S3 URLs with `X-Amz-Expires=300`.** They stop working **five minutes** after the request that returned them; a screen holding them has to refetch, not retry the image.

### What `GET /identity` filters on

Verified against [docs/identities-api.postman_collection.json](./identities-api.postman_collection.json), which is the authority for this endpoint's query surface. Field names are written camelCase in `buildFilter` and decamelized on the way out.

| Sent as | Write it as | Notes |
| --- | --- | --- |
| `statuses[]` | `statuses` | **Numbers**, repeated. `4,5,6` is the printer queue. |
| `search` | `search` | The free-text box. |
| `member_name` | `memberName` | Per-column text filter. |
| `member_phone` | `memberPhone` | Per-column text filter; the stored number is bare digits. |
| `template_title` | `templateTitle` | Free text, not an id. |
| `organization_id` | `organizationId` | **Singular** — one value. `/member` takes `organization_ids[]`; using a multi-select facet here sends a parameter the backend ignores. |
| `price` | `price` | |
| `created_at_range[]` | `createdAtRange` | Two ISO instants, from and to, sent together. |
| `updated_at_range[]` | `updatedAtRange` | Same shape. |

### The response skip config needs a list envelope

`skipResponseKeyConversion: { request: true }` is what keeps the template variable names intact on the way back. It is applied per row by `transformResponseKeys` (utils/api/key-conversion.ts), which sees the *body* — so a list has to be matched as `{ data: [...] }`, not the doubly-nested `{ data: { data: [...] } }` that `GetResponse` describes. Matching only the latter is silent: rows render, and only the keys that were supposed to be left alone come back rewritten.

---

## templates

**Endpoint:** `/template` · [types](../features/templates/types.ts) · [api](../features/templates/api.ts)

The ID card design plus its issuance metadata. Authored by the [photo editor](./photo-editor.md).

```ts
export type Template = {
  id: number;
  title: string;
  description: string;
  price: string;                    // string, not number
  shareKey: string;                 // public self-service link key
  identitiesCount: number;
  template: Record<string, unknown>;  // the design document
  frontImage?: string;
  backImage?: string;
  is_enabled: number;               // snake_case on the entity
  branchRequired: boolean;
  identityDuration: number;         // validity period; 0 = unlimited
  organization?: Organization;
};

export type TemplateExport = {
  id: number;
  status: string;
  file: string;                     // download URL
  createdAt: string;
  updatedAt: string;
  template?: Template;
  organization?: Organization;
};

export type CreateTemplateInput = {
  title: string;
  description: string;
  price: string;
  frontImage?: string;
  backImage?: string;
  template: Record<string, unknown>;
  is_enabled: string;               // string on input, number on output
  branchRequired: boolean;
  identityDuration: number;
};

export type UpdateTemplateInput = CreateTemplateInput;   // identical shape

export type CloneTemplateInput = {
  templateId: number;
  title: string;
  description: string;
  price: string;
  organizationId?: number;
};
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetTemplates(filter)` | GET | `/template` | `GetResponse<Template[]>` |
| `useGetTemplate(id)` | GET | `/template/{id}` | `Template` |
| `useCreateTemplate()` | POST | `/template` | `Template` |
| `useUpdateTemplate()` | PUT | `/template/{id}` | `Template` |
| `useDeleteTemplate()` | DELETE | `/template/{id}` | `void` |
| `useCloneTemplate()` | POST | `/template/clone` | `Template` |
| `usePublicTemplate({ shareKey })` | GET | `https://api.bajat.net/api/public/v1/template/{shareKey}` ⚠️ | `Template` |
| `useExportTemplateAsCSV()` | GET | `/template/export/{id}` | export payload |
| `useResetTemplateSequences()` | PUT | `/template/{id}/reset` | `void` |
| `useGetTemplatesExports(filter)` | GET | `/export` | `GetResponse<TemplateExport[]>` |

> `price` is a **string**; `is_enabled` is a **number on the entity but a string on input**. Both are deliberate — match them exactly or the backend rejects the write.

**`GET /template` filters:** `page`, `per_page`, `search`, `type`, `organization_id`. `type` is the ownership split — `organization` (rows with an `organization`; an organization user's own, every organization's for an admin) or `global` (the public catalogue, no `organization`). `organization_id` is an admin's narrowing of the `organization` set and does nothing on `global`. A template becomes an organization's through `POST /template/clone` with `organization_id` (admin) or with none (the token's organization); `POST /template` itself never carries an owner — the server infers it from the token. See [CARD-CREATE-ASSIGN-GALLERY.md](./CARD-CREATE-ASSIGN-GALLERY.md).

The shape of `template` (the design document) is documented in [photo-editor.md §8](./photo-editor.md#8-serialization--helperts).

---

## users

**Endpoint:** `/user` · [types](../features/users/types.ts) · [api](../features/users/api.ts)

Platform-level users. This is the type stored in the auth session.

```ts
export type User = {
  id: number;
  name: string;
  phone: string;
  type: "admin" | "organization_user";
  tfaEnabled: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  organization?: Organization;
  roles?: Role[];                   // permission checks walk this
};

export type CreateUsersInput = {
  name: string;
  phone: string;
  roleId?: number[];                // singular name, array value
  isEnabled?: number;
};

export type UpdateUsersInput = {
  name?: string;
  roleId?: number[];
  isEnabled?: number;
};
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetUsers(filter)` | GET | `/user` | `GetResponse<User[]>` |
| `useGetUser(id)` | GET | `/user/{id}` | `User` |
| `useCreateUser()` | POST | `/user` | `User` |
| `useUpdateUser()` | PUT | `/user/{id}` | `User` |
| `useDeleteUser()` | DELETE | `/user/{id}` | `void` |
| `useResetUserMfa()` | POST | `/user/{id}/reset` | `void` |

> `roleId` is named singular but takes an **array**. Other features use `roleIds`.

`user.roles[].permissions[]` is what `useAuthStore.can()` walks — so a `User` fetched without `roles` populated will fail every permission check.

---

## roles

**Endpoint:** `/role` · [types](../features/roles/types.ts) · [api](../features/roles/api.ts)

```ts
export type Role = {
  id: number;
  name: string;
  type: RoleType;
  createdAt: string;
  updatedAt: string;
  permissions?: Permission[];
  organization?: Organization;
  branch?: Branch;
};

export type RoleType = "admin" | "organization" | "branch";

export type CreateRoleInput = {
  name: string;
  type: RoleType;
  permissions: number[];            // permission IDs — required
  organizationId?: number;
  branchId?: number;
};

export type UpdateRoleInput = {
  name?: string;
  type?: RoleType;
  permissions?: number[];
  organizationId?: number;
  branchId?: number;
};
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetRoles(filter)` | GET | `/role` | `GetResponse<Role[]>` |
| `useGetRole(id)` | GET | `/role/{id}` | `Role` |
| `useCreateRole()` | POST | `/role` | `Role` |
| `useUpdateRole()` | PUT | `/role/{id}` | `Role` |
| `useDeleteRole()` | DELETE | `/role/{id}` | `void` |

> Input takes `permissions: number[]` (IDs); output returns `permissions?: Permission[]` (objects). Same key, different shape in each direction.

---

## permissions

**Endpoint:** `/permission` · read-only · [types](../features/permissions/types.ts) · [api](../features/permissions/api.ts)

```ts
export type Permission = {
  id: number;
  name: string;                     // "<tier>-<entity>.<action>"
  type: RoleType;                   // "admin" | "organization" | "branch"
  createdAt: string;
  updatedAt: string;
};
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetPermissions(filter)` | GET | `/permission` | `GetResponse<Permission[]>` |

`name` is prefixed by tier — `admin-member.create`, `organization-member.create`. `useAuthStore.can("member.create")` matches the bare name against both prefixes; pass `prefixed: true` for an exact match. [features/permissions/utils.ts](../features/permissions/utils.ts) turns the flat list into a tree.

---

## branches

**Endpoint:** `/branch` · [types](../features/branches/types.ts) · [api](../features/branches/api.ts)

```ts
export type Branch = {
  id: number;
  name: string;
  parentId?: number;                // self-referencing hierarchy
  organizationId: number;
  nodeIds: number[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lat?: string;
  lng?: string;
  organization?: Organization;
  parent?: Branch;                  // recursive
  nodes?: Node[];
};

export type CreateBranchInput = {
  name: string;
  parentId?: number;
  organizationId?: number;
  nodeIds: number[];                // required
  isEnabled?: number;
  lat?: string;
  lng?: string;
};

export type UpdateBranchInput = {
  name?: string;
  parentId?: number | null;         // null detaches from parent
  organizationId?: number;
  nodeIds?: number[];
  isEnabled?: number;
  lat?: string;
  lng?: string;
};
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetBranches(filter)` | GET | `/branch` | `GetResponse<Branch[]>` |
| `useGetBranch(id)` | GET | `/branch/{id}` | `Branch` |
| `useCreateBranch()` | POST | `/branch` | `Branch` |
| `useUpdateBranch()` | PUT | `/branch/{id}` | `Branch` |
| `useDeleteBranch()` | DELETE | `/branch/{id}` | `void` |
| `useGetBranchesByTemplateId(id)` | GET | `/branch/template/{templateId}` | `GetResponse<Branch[]>` |

> `parentId` accepts `null` on update — that is how you detach a branch from its parent. `undefined` leaves it unchanged.

---

## nodes

**Endpoint:** `/node` · [types](../features/nodes/types.ts) · [api](../features/nodes/api.ts)

A step in the approval workflow. `NodeHistory` is the audit trail attached to an `IDCard`.

```ts
export type Node = {
  id: number;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  organization?: Organization;
};

export type CreateNodeInput = {
  name: string;
  color: string;
  organizationId?: number;
};

export type UpdateNodeInput = CreateNodeInput;

export type NodeHistory = {
  id: number;
  attachments: string[];
  fields: { key: string; value: string }[];
  createdAt: string;
  user: User;                       // who acted
  notes: string;
};
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetNodes(filter)` | GET | `/node` | `GetResponse<Node[]>` |
| `useGetNode(id)` | GET | `/node/{id}` | `Node` |
| `useCreateNode()` | POST | `/node` | `Node` |
| `useUpdateNode()` | PUT | `/node/{id}` | `Node` |
| `useDeleteNode()` | DELETE | `/node/{id}` | `void` |

`NodeHistory` has no endpoint of its own — it arrives embedded in `IDCard.nodeHistory`.

---

## organization-users

**Endpoint:** `/organization_user` · [types](../features/organization-users/types.ts) · [api](../features/organization-users/api.ts)

```ts
export type OrganizationUser = {
  id: number;
  name: string;
  phone: string;
  type: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  roles?: Role[];
  organization?: Organization;
  nodes?: Node[];
};

export type CreateOrganizationUsersInput = {
  name: string;
  phone: string;
  organizationId?: number;
  roleIds?: number[];               // plural here (User uses roleId)
  nodeIds?: number[];
  isEnabled?: number;
};

export type UpdateOrganizationUsersInput = {
  name?: string;
  phone?: string;
  organizationId?: number;
  roleIds?: number[];
  nodeIds?: number[];
  isEnabled?: number;
};
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetOrganizationUsers(filter)` | GET | `/organization_user` | `GetResponse<OrganizationUser[]>` |
| `useGetOrganizationUser(id)` | GET | `/organization_user/{id}` | `OrganizationUser` |
| `useCreateOrganizationUser()` | POST | `/organization_user` | `OrganizationUser` |
| `useUpdateOrganizationUser()` | PUT | `/organization_user/{id}` | `OrganizationUser` |
| `useDeleteOrganizationUser()` | DELETE | `/organization_user/{id}` | `void` |
| `useResetOrganizationUserMfa()` | POST | `/organization_user/{id}/reset` | `void` |

---

## branch-users

**Endpoint:** `/branch_user` · [types](../features/branch-users/types.ts) · [api](../features/branch-users/api.ts)

`OrganizationUser` plus a `branch`.

```ts
export type BranchUser = {
  id: number;
  name: string;
  phone: string;
  type: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  roles?: Role[];
  organization?: Organization;
  branch?: Branch;                  // the distinguishing field
  nodes?: Node[];
};

export type CreateBranchUserInput = {
  name: string;
  phone: string;
  organizationId?: number;
  branchId: number;                 // required
  roleIds?: number[];
  nodeIds?: number[];
  isEnabled?: number;
};

export type UpdateBranchUserInput = {
  name?: string;
  phone?: string;
  organizationId?: number;
  branchId?: number;
  roleIds?: number[];
  nodeIds?: number[];
  isEnabled?: number;
};
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetBranchUsers(filter)` | GET | `/branch_user` | `GetResponse<BranchUser[]>` |
| `useGetBranchUser(id)` | GET | `/branch_user/{id}` | `BranchUser` |
| `useCreateBranchUser()` | POST | `/branch_user` | `BranchUser` |
| `useUpdateBranchUser()` | PUT | `/branch_user/{id}` | `BranchUser` |
| `useDeleteBranchUser()` | DELETE | `/branch_user/{id}` | `void` |
| `useResetBranchUserMfa()` | POST | `/branch_user/{id}/reset` | `void` |

---

## auth

**Endpoint:** `/auth/*` · [types](../features/auth/types.ts) · [api](../features/auth/api.ts)

```ts
export type OTPInput = {
  phone: string;
};

export type LoginInput = {
  phone: string;
  otp: string;
  captchaToken: string | null;
};

export type LoginResponse = {
  accessToken?: string;             // full session token
  tempToken?: string;               // 2FA-pending token
  tokenType?: string;
  expiresIn?: number;
  user: User;
};

export type TwoFactorSetupResponse = {
  secret: string;
  qrCode: string;                   // SVG XML string, not a URL
};

export type TotpVerifyInput = {
  otp: string;
};
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useSendOTP()` | POST | `/auth/send_otp` | `void` |
| `useLogin()` | POST | `/auth/login` | `LoginResponse` |
| `useReCaptchaCheck()` | GET | `/auth/recaptcha_check` | `{ recaptchaRequired: boolean }` |
| `use2FASetup(enabled)` | GET | `/auth/2fa/setup` | `TwoFactorSetupResponse` |
| `use2FAEnable()` | POST | `/auth/2fa/enable` | `LoginResponse` |
| `useLogout()` | POST | `/auth/logout` | `void` |

> **`accessToken` and `tempToken` are both optional — which one you get determines the next step.** `accessToken` means login is complete; `tempToken` means 2FA is required and must be stored as `temp_token` in `localStorage`, where `getAuthToken()` picks it up ahead of the session token. See [authentication.md](./authentication.md).

`qrCode` is raw SVG markup, not an image URL.

---

## statistic

**Endpoint:** `/statistics` · read-only · [types](../features/statistic/types.ts) · [api](../features/statistic/api.ts)

```ts
export interface DashboardMonthStats {
  month: string;
  total: number;
}

export interface LatestMemberRequest extends Omit<Member, "organizations"> {
  memberId: number;
  status: "pending" | "approved" | "rejected" | string;
  organization?: Organization;      // singular, replaces Member.organizations
}

export interface TopOrganization extends Organization {
  identitiesCount: number;
}

export type DashboardtatisticResponse = {
  id: number;
  totalIdentities: number;
  totalMemberRequests: number;
  totalMembers: number;
  totalOrganizations: number;
  totalPendingMemberRequests: number;
  identitiesInYear: DashboardMonthStats[];
  latestMembersRequests: LatestMemberRequest[];
  topOrganizations: TopOrganization[];
};
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetStatistics()` | GET | `/statistics` | `DashboardtatisticResponse` |

> Returns the object directly — **no pagination envelope**.
>
> Two naming notes: `DashboardtatisticResponse` is missing an `S` (typo in the source, kept here so it matches the import), and `status` is a union widened with `| string`, so it accepts any string and gives you no exhaustiveness checking.

---

## payments

**Endpoint:** `/payment` · read-only · [types](../features/payments/types.ts) · [api](../features/payments/api.ts)

```ts
export type Payment = {
  id: number;
  requestId: string;
  amount: string;                   // string, not number
  currency: string;
  status: string;                   // free-form, not a union
  paidAt: string | null;            // null until paid
  createdAt: string;
  updatedAt: string;
  organization?: Organization;
  template?: Template;
  member?: Member;
};
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetPayments(filter)` | GET | `/payment` | `GetResponse<Payment[]>` |
| `useGetPayment(id)` | GET | `/payment/{id}` | `Payment` |

> No create/update/delete — payments are recorded by the backend. There is no input type for this feature.

---

## black-list

**Endpoint:** `/blacklist` · [types](../features/black-list/types.ts) · [api](../features/black-list/api.ts)

```ts
export type BlackList = {
  id: number;
  phone: string;
  name: string;
  organization: Organization;       // required
  createdAt: string;
  updatedAt: string;
};

export type CreateBlackListInput = {
  phone: string;
  name: string;
  organizationId?: number;
};
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetBlackLists(filter)` | GET | `/blacklist` | `GetResponse<BlackList[]>` |
| `useGetBlackList(id)` | GET | `/blacklist/{id}` | `BlackList` |
| `useCreateBlackList()` | POST | `/blacklist` | `BlackList` |
| `useDeleteBlackList()` | DELETE | `/blacklist/{id}` | `void` |

> No update — entries are added and removed, never edited. There is no `UpdateBlackListInput`.

---

## api-keys

**Endpoint:** `/access_key` · [types](../features/api-keys/types.ts) · [api](../features/api-keys/api.ts)

```ts
export interface ApiKey {
  id: number;
  name: string;
  key: string;                      // the secret
  createdAt: string;
  updatedAt: string;
  organization: Organization;
  user: User;                       // who created it
}

export type CreateApiKeyInput = { name: string };
export type UpdateApiKeyInput = { name: string };
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetApiKeys(filter)` | GET | `/access_key` | `GetResponse<ApiKey[]>` |
| `useGetApiKey(id)` | GET | `/access_key/{id}` | `ApiKey` |
| `useCreateApiKey()` | POST | `/access_key` | `ApiKey` |
| `useUpdateApiKey()` | POST + `_method=PUT` | `/access_key/{id}` | `ApiKey` |
| `useDeleteApiKey()` | DELETE | `/access_key/{id}` | `void` |

> The endpoint is `/access_key`, not `/api_key` — the only feature whose path doesn't track its folder name.

---

## webhooks

**Endpoint:** `/webhook` · singleton · [types](../features/webhooks/types.ts) · [api](../features/webhooks/api.ts)

```ts
export interface Webhook {
  url: string;
  secretKey: string;
  secretValue: string;
  method: string;
}

export type CreateWebHookInput = {
  webhookUrl: string;               // note: NOT `url`
};
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetWebhookQuery()` | GET | `/webhook` | `Webhook` |
| `useUpdateCreateWebhook()` | PUT | `/webhook` | `Webhook` |

> A **singleton** — one webhook per organization. No `id`, no list endpoint, no pagination, and a single PUT that creates or updates. The input field is `webhookUrl` while the entity field is `url`.

---

## application-form

**Endpoint:** `/organization/form` · [types](../features/application-form/types.ts) · [api](../features/application-form/api.ts)

The custom join form an organization presents to applicants. Answers come back in `MemberRequest.joinData`.

```ts
export type ApplicationFormInputType =
  | "string" | "number" | "boolean" | "date" | "select" | "image" | "file";

export interface ApplicationFormInput {
  InputName: string;                // PascalCase keys — intentional
  InputLabel: string;
  InputType: ApplicationFormInputType;
  InputRequired: boolean;
  Options?: string[];               // for select
}

export interface ApplicationForm {
  id: number;
  body: ApplicationFormInput[];
  organizationId?: string;          // string
}

export type CreateApplicationForm = {
  body: ApplicationFormInput[];
  organizationId?: string;
};

export type UpdateApplicationForm = CreateApplicationForm;
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetApplicationFormByOrgId(orgId)` | GET | `/organization/{id}/form` | `ApplicationForm` |
| `useCreateApplicationForm()` | POST | `/organization/form` | `ApplicationForm` |
| `useUpdateApplicationForm()` | PUT | `/organization/form/{id}` | `ApplicationForm` |

> **`InputName`, `InputLabel`, `InputType` are PascalCase** — unlike every other type in the codebase. These are field definitions the backend stores verbatim, so don't "fix" the casing.

---

## form-template

**Endpoint:** `/form` · [types](../features/form-template/types.ts) · [api](../features/form-template/api.ts)

Distinct from `application-form` — a reusable named form definition.

```ts
export type FormTemplate = {
  id: number;
  name: string;
  description: string;
  form: string;                     // serialized JSON string, not an object
  slug: string;
  organizationId?: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateFormTemplateInput = {
  name: string;
  description: string;
  form: string;
  slug: string;
  organizationId?: number;
};

export type UpdateFormTemplateInput = CreateFormTemplateInput;
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetForms(filter)` | GET | `/form` | `GetResponse<FormTemplate[]>` |
| `useGetForm(id)` | GET | `/form/{id}` | `FormTemplate` |
| `useCreateForm()` | POST | `/form` | `FormTemplate` |
| `useUpdateForm()` | PUT | `/form/{id}` | `FormTemplate` |
| `useDeleteForm()` | DELETE | `/form/{id}` | `void` |

> `form` is a **JSON string**, not a parsed object — `JSON.parse` it before use. Compare with `Template.template`, which arrives as an object.

---

## template-flow

**Endpoint:** `/template/flow` · [types](../features/template-flow/types.ts) · [api](../features/template-flow/api.ts)

Binds a template to its ordered approval nodes.

```ts
export type TemplateFlow = {
  id: number;
  templateId: number;
  nodes: Node[];                    // ordered approval chain
};

export type CreateTemplateFlowInput = {
  templateId: number;
  nodeIds: number[];
};

export type UpdateTemplateFlowInput = CreateTemplateFlowInput;
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetTemplateFlow(templateId)` | GET | `/template/flow/{templateId}` | `TemplateFlow` |
| `useCreateTemplateFlow()` | POST | `/template/flow` | `TemplateFlow` |

> Only get-by-id and create are exported — no list, update, or delete hook, though `UpdateTemplateFlowInput` exists. Re-creating replaces the flow.

---

## customers

**Endpoint:** `/customers` · [types](../features/customers/types.ts) · [api](../features/customers/api.ts)

```ts
export type Customer = {
  id: string;                       // string — the only entity that does this
  name: string;
  phoneNumber: string;              // phoneNumber, not phone
  gender: "male" | "female";
  organization: string;             // a string, not an Organization
  department: string;
  dateOfBirth: string;
};

export type CreateCustomersInput = { name: string };
export type UpdateCustomersInput = { name?: string | undefined };
```

| Hook | Method | Path | Returns |
| --- | --- | --- | --- |
| `useGetCustomers(filter)` | GET | `/customers` | `GetResponse<Customer[]>` |
| `useGetCustomer(id)` | GET | `/customers/{id}` | `Customer` |
| `useCreateCustomer()` | POST | `/customers` | `Customer` |
| `useUpdateCustomer()` | PUT | `/customers/{id}` | `Customer` |
| `useDeleteCustomer()` | DELETE | `/customers/{id}` | `void` |

> This type breaks every convention in the codebase: `id` is a string, the phone field is `phoneNumber`, `organization` is a plain string rather than a relation, there are no timestamps, and the endpoint is plural. It looks like scaffolding that was never reconciled with the rest — **verify against the live API before relying on it.**

---

## Cross-feature gotchas

Collected here because each has caused a real bug or will:

| # | Trap |
| --- | --- |
| 1 | **Booleans in, numbers out.** Entities return `isEnabled: boolean`; inputs take `isEnabled?: number` (`0`/`1`). |
| 2 | **`ids` sends snake_case.** Key conversion is disabled — write `template_id`, not `templateId`. |
| 3 | **`IDCard.status` reads as a name, writes as a number.** Map through `STATUS_NAMES` / `statusId` in [features/ids/types.ts](../features/ids/types.ts) — the index *is* the id, and `PENDING` is `0`, so a fallback of `0` is a real status. |
| 4 | **`roleId` vs `roleIds`.** `users` uses singular `roleId` (still an array); org/branch users use `roleIds`. |
| 5 | **`organizationId` type varies.** `number` in most features, `string` in `members-requests` and `application-form`. |
| 6 | **Numbers as strings.** `Template.price`, `Payment.amount`, and all `lat`/`lng` are strings. |
| 7 | **`Template.is_enabled` is a number on the entity, a string on input.** |
| 8 | **`Member.organizations` is an array**; almost everything else has a single `organization`. |
| 9 | **Duplicate input names.** `members` and `members-requests` both export `CreateMembersInput` with different shapes. |
| 10 | **`FormTemplate.form` is a JSON string**; `Template.template` is a parsed object. |
| 11 | **`ApplicationFormInput` uses PascalCase keys** — deliberate, don't normalize. |
| 12 | **Relations are optional.** A `User` without `roles` populated fails every permission check. |
| 13 | **List responses double-nest**: `response.data.data`, count at `response.data.meta.total`. |
| 14 | **`Customer` follows none of the conventions** — treat as unverified. |

---

## Adding a feature

1. Define `Entity`, `CreateEntityInput`, `UpdateEntityInput` in `features/<domain>/types.ts`.
2. Instantiate the factory in `features/<domain>/api.ts`:

```ts
const thingApi = createApiFactory<Thing, CreateThingInput, UpdateThingInput>({
  entityName: "thing",     // query-key prefix — must be unique
  endpoint: "/thing",
});
```

3. Re-export the hooks, and build any custom query keys **on top of** `thingApi.QueryKeys` so mutations invalidate them.
4. Add a section here.

See [architecture.md §6](./architecture.md#6-feature-modules) for the module conventions and [network-layer.md](./network-layer.md) for the factory internals.
