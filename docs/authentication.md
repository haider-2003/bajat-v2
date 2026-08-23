# Bajat Dashboard — Authentication & Authorization

How a user signs in, where the token lives, how it reaches the API, how routes are guarded, and how permissions gate the UI.

See [network-layer.md](./network-layer.md) for the Axios client and API factory this builds on.

| Concern | File |
| --- | --- |
| Auth API hooks (login, OTP, 2FA, logout) | [features/auth/api.ts](../features/auth/api.ts) |
| Auth state + `can()` | [features/auth/store.ts](../features/auth/store.ts) |
| Auth request/response types | [features/auth/types.ts](../features/auth/types.ts) |
| Token read + 401 handling | [utils/api/auth-helpers.ts](../utils/api/auth-helpers.ts) |
| Route guard | [components/auth/auth-wrapper.tsx](../components/auth/auth-wrapper.tsx) |
| Permission gate component | [components/permission/index.tsx](../components/permission/index.tsx) |
| Login screen | [app/(minimal)/[locale]/login/page.tsx](<../app/(minimal)/[locale]/login/page.tsx>) |
| Logout trigger | [components/shell/header/header.tsx](../components/shell/header/header.tsx) |

---

## 1. The model in one paragraph

Authentication is **phone + OTP, then mandatory TOTP**, ending in a bearer token stored in `localStorage`. There are no cookies and no server-side session — the token is read out of `localStorage` on every Axios request and attached as `Authorization: Bearer …`. Route protection is entirely client-side: a `<AuthWrapper>` component checks the store after hydration and redirects to `/login`. Authorization is a flat list of permission strings carried on the user's roles, checked by `useAuthStore().can(...)` and applied in the UI by a `<Permission can="…">` wrapper.

---

## 2. The login flow

Three steps, driven by a `step` state machine in the login page: `"phone" → "otp" → "totp"`.

```
┌─ step: "phone" ────────────────────────────────────────────┐
│  POST /auth/send_otp   { phone }                           │
│  → SMS sent                                                │
└────────────────────────────────────────────────────────────┘
                          ↓
┌─ step: "otp" ──────────────────────────────────────────────┐
│  GET  /auth/recaptcha_check   (on page load)               │
│  POST /auth/login   { phone, otp, captchaToken }           │
│  → { tempToken, user }                                     │
│  localStorage.setItem("temp_token", tempToken)             │
│  branch on user.tfaEnabled:                                │
│     false → show QR setup   true → show code input only    │
└────────────────────────────────────────────────────────────┘
                          ↓
┌─ step: "totp" ─────────────────────────────────────────────┐
│  GET  /auth/2fa/setup    (only when !tfaEnabled)           │
│       → { secret, qrCode }  ← SVG XML string               │
│  POST /auth/2fa/enable   { otp }                           │
│  → { accessToken, user }                                   │
│  localStorage.removeItem("temp_token")                     │
│  setAuth(user, accessToken)   → persisted under "auth"     │
│  router.push("/")                                          │
└────────────────────────────────────────────────────────────┘
```

**The key detail:** `POST /auth/login` does *not* return a usable session token. It returns a **`tempToken`**, and the flow always continues to the TOTP step. Only `POST /auth/2fa/enable` returns the real `accessToken`. TOTP is not optional — `tfaEnabled` only decides whether the user sees a QR code to enrol or just a code input.

### The two tokens

| Token | Storage key | Set at | Cleared at | Purpose |
| --- | --- | --- | --- | --- |
| `tempToken` | `temp_token` (raw string) | after `POST /auth/login` | after `POST /auth/2fa/enable`, and on logout | authorizes only the `/auth/2fa/*` calls |
| `accessToken` | `auth` (JSON, via Zustand persist) | after `POST /auth/2fa/enable` | on logout or any 401 | the real session token |

`getAuthToken()` checks `temp_token` **first**, which is what lets the half-authenticated `/auth/2fa/setup` and `/auth/2fa/enable` requests carry a token at all:

```ts
// utils/api/auth-helpers.ts
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null; // SSR-safe

  const tempToken = localStorage.getItem("temp_token");
  if (tempToken) return tempToken;                // ← temp wins while it exists

  const authStorage = localStorage.getItem("auth");
  if (authStorage) {
    const { state } = JSON.parse(authStorage);    // zustand persist shape
    if (state?.token) return state.token;
  }
  return null;
}
```

This is also why `temp_token` **must** be removed on success — if it lingers, every subsequent request would send the temp token instead of the real one.

---

## 3. The auth API hooks — [features/auth/api.ts](../features/auth/api.ts)

Auth endpoints don't use `createApiFactory` (they aren't a REST resource); they're plain React Query hooks over the shared `api` instance.

```ts
export const useSendOTP = () =>
  useMutation({
    mutationFn: async (body: OTPInput): Promise<void> => {
      await api.post("/auth/send_otp", body);
    },
  });

export const useLogin = () =>
  useMutation({
    mutationFn: async (data: LoginInput): Promise<LoginResponse> => {
      const response = await api.post("/auth/login", data);
      return response.data;
    },
  });

// enabled-gated: only fetches the QR when the user actually needs to enrol
export const use2FASetup = (enabled: boolean) =>
  useQuery({
    queryKey: ["2fa-setup"],
    queryFn: async (): Promise<TwoFactorSetupResponse> => {
      const response = await api.get("/auth/2fa/setup");
      return response.data;
    },
    enabled,
    staleTime: Infinity, // QR code doesn't need to refresh
  });

export const use2FAEnable = () =>
  useMutation({
    mutationFn: async (data: TotpVerifyInput): Promise<LoginResponse> => {
      const response = await api.post("/auth/2fa/enable", data);
      return response.data;
    },
  });

export const useLogout = () =>
  useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post("/auth/logout");
    },
  });
```

Types ([features/auth/types.ts](../features/auth/types.ts)):

```ts
export type OTPInput = { phone: string };

export type LoginInput = {
  phone: string;
  otp: string;
  captchaToken: string | null;
};

export type LoginResponse = {
  accessToken?: string;   // only present after 2fa/enable
  tempToken?: string;     // only present after login
  tokenType?: string;
  expiresIn?: number;
  user: User;
};

export type TwoFactorSetupResponse = {
  secret: string;
  qrCode: string; // SVG XML string, not a data URL
};

export type TotpVerifyInput = { otp: string };
```

Note `qrCode` is raw SVG markup — the login page base64-encodes it inline: `` `data:image/svg+xml;base64,${btoa(setup2FA.data.qrCode)}` ``.

### reCAPTCHA

reCAPTCHA is conditional, not always-on, and can be triggered from two directions:

- **On page load** — `GET /auth/recaptcha_check` returns `{ recaptchaRequired }`; if true, the widget renders on the OTP step.
- **On failure** — a failed `POST /auth/login` may return `require_recaptcha` in the error body, which flips the widget on and resets the token so the user must solve it again.

```tsx
const requiresRecaptcha = error?.response?.data?.require_recaptcha;
if (requiresRecaptcha) setRecaptchaRequired(true);

if (recaptchaRef.current) {
  recaptchaRef.current.reset();
  setCaptchaToken(null);
}
```

`send_otp` also surfaces a dedicated message on HTTP 429 (rate-limited resends).

---

## 4. The auth store — [features/auth/store.ts](../features/auth/store.ts)

Zustand + `persist`, keyed `"auth"` in `localStorage`:

```ts
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthed: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  can: (permission: string, prefixed?: boolean) => boolean;
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
          localStorage.removeItem("temp_token");
        }
        set({ user: null, token: null, isAuthed: false });
      },

      can: (permission, prefixed = false) => { /* §6 */ },
    }),
    { name: "auth" },
  ),
);
```

The store is the single source of truth for *UI* auth state; the Axios layer deliberately reads `localStorage` directly instead of subscribing to the store, so it works in non-React code paths too.

---

## 5. Route protection — [components/auth/auth-wrapper.tsx](../components/auth/auth-wrapper.tsx)

`middleware.ts` is **i18n only** (`createMiddleware(routing)`) — it does no auth checking. All route protection happens client-side in `AuthWrapper`, mounted inside both root layouts:

```tsx
// app/(dashboard)/[locale]/layout.tsx
<ReactQueryProvider>
  <AuthWrapper>
    <Shell>{children}</Shell>
  </AuthWrapper>
  <Notifications />
</ReactQueryProvider>
```

```tsx
const PUBLIC_ROUTES = ["/login", "/ids-templates-forms/[id]"];

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { isAuthed, token } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isHydrated, setIsHydrated] = useState(false);

  // Wait for the persisted store to rehydrate from localStorage
  useEffect(() => { setIsHydrated(true); }, []);

  useEffect(() => {
    if (!isHydrated) return;                 // don't judge before rehydration
    if (isPublicRoute(pathname)) return;
    if (!isAuthed || !token) router.push("/login");
  }, [isAuthed, token, pathname, router, isHydrated]);

  if (!isHydrated) return null;              // blank frame, avoids a login flash
  if (isPublicRoute(pathname)) return <>{children}</>;
  if (isAuthed && token) return <>{children}</>;
  return null;                               // rendering nothing while redirecting
}
```

Two things worth understanding:

- **The hydration gate exists to prevent a false negative.** On first paint the persisted store is still empty, so an un-gated check would bounce an authenticated user to `/login`. `isHydrated` delays the verdict by one effect tick — at the cost of rendering `null` on the very first frame.
- **`PUBLIC_ROUTES` supports dynamic segments.** `isPublicRoute` converts `[id]`-style entries into a regex (`[^/]+` per segment), which is how the public template form `/ids-templates-forms/[id]` stays reachable without a session.

Note the paths are compared against the **locale-stripped** pathname from `@/i18n/navigation`, not the raw URL.

---

## 6. Authorization — permissions

### The data shape

A `User` has `roles`, each role has `permissions`, each permission has a `name`:

```ts
// features/users/types.ts
export type User = {
  id: number;
  name: string;
  phone: string;
  type: "admin" | "organization_user";
  tfaEnabled: boolean;
  isEnabled: boolean;
  organization?: Organization;
  roles?: Role[];
};

// features/roles/types.ts
export type Role = {
  id: number;
  name: string;
  type: "admin" | "organization" | "branch";
  permissions?: Permission[];
  organization?: Organization;
  branch?: Branch;
};
```

Permission names are **scope-prefixed** on the backend: `admin-members-list`, `organization-members-list`, and so on.

### `can()`

```ts
can: (permission: string, prefixed: boolean = false) => {
  const state = get();
  if (!state.isAuthed || !state.user) return false;
  if (!state.user.roles || state.user.roles.length === 0) return false;

  return state.user.roles.some((role) =>
    role.permissions?.some((perm) => {
      if (!prefixed) {
        // caller passed a bare name → try both scopes
        return (
          perm.name === `admin-${permission}` ||
          perm.name === `organization-${permission}`
        );
      }
      return perm.name === permission; // caller passed the full name
    }),
  );
},
```

So `can("members-list")` matches **either** `admin-members-list` or `organization-members-list`; `can("branch-members-list", true)` matches that exact string only. The default (`prefixed = false`) is what almost all call sites use.

### The `<Permission>` component — [components/permission/index.tsx](../components/permission/index.tsx)

The declarative wrapper used throughout the app:

```tsx
<Permission can="members-list">
  <Button onClick={open}>Add member</Button>
</Permission>
```

Behavior:

- **Unauthorized + default** → renders nothing at all.
- **Unauthorized + `showWithTooltip`** → renders the child `disabled`, dimmed to `opacity: 0.6`, wrapped in a tooltip.
- **Array of permissions** → `requireAll` (default `true`) means AND; `requireAll={false}` means OR.

```tsx
<Permission can={["members-list", "members-edit"]} requireAll={false}>
  <EditButton />
</Permission>

<Permission can="members-delete" showWithTooltip tooltipLabel="Not allowed">
  <DeleteButton />
</Permission>
```

It clones the child and injects `disabled` + `style`, so the child must accept both props (Mantine components do).

### Direct store access

For non-wrapper cases — conditional data fetching, whole sections, admin-only nav — read `can` off the store directly:

```tsx
const can = useAuthStore((s) => s.can("show-member"));
const user = useAuthStore((s) => s.user);

// admin-only sections check user.type instead of a permission
{user?.type === "admin" && <AdminNavSection />}
```

Selecting a slice (`(s) => s.user`) rather than destructuring the whole store keeps re-renders narrow.

---

## 7. Logout

Two paths, both ending in the same place.

**Explicit** — [components/shell/header/header.tsx](../components/shell/header/header.tsx). The local logout runs even if the server call fails, so a network error can never trap the user in a signed-in shell:

```tsx
const { user, logout } = useAuthStore();
const logoutMutation = useLogout();

const handleLogout = () => {
  logoutMutation.mutate(undefined, {
    onSuccess: () => {
      logout();
      router.push("/login");
    },
    onError: () => {
      // Even if API fails, still logout locally
      logout();
      router.push("/login");
    },
  });
};
```

**Implicit (401)** — [utils/api/auth-helpers.ts](../utils/api/auth-helpers.ts), fired by the Axios response interceptor on *any* 401:

```ts
export function handleUnauthorizedResponse(): void {
  localStorage.removeItem("auth");
  localStorage.removeItem("temp_token");
  window.location.href = "/login";
}
```

This is a **hard navigation**, not a router push — it wipes all React state and the React Query cache along with it. It also bypasses the store's own `logout()`, clearing `localStorage` directly. Feature code should never handle 401 itself.

---

## 8. Doing auth work — quick reference

**Gate a button on a permission**

```tsx
<Permission can="members-create">
  <Button onClick={open}>{t("actions.add")}</Button>
</Permission>
```

**Gate a query on a permission**

```tsx
const canList = useAuthStore((s) => s.can("members-list"));
const query = useGetMembers(filter, { enabled: canList });
```

**Read the current user**

```tsx
const user = useAuthStore((s) => s.user);
```

**Make a route public** — add it to `PUBLIC_ROUTES` in [components/auth/auth-wrapper.tsx](../components/auth/auth-wrapper.tsx), using `[id]` for dynamic segments.

**Call an endpoint that must be unauthenticated** — it still passes through the request interceptor, so the token is attached anyway; public endpoints live on a different host (`https://api.bajat.net/api/public/v1/…`) and simply ignore it.

### Gotchas

- `temp_token` shadows the real token. If a 2FA flow is abandoned mid-way without clearing it, every request sends the temp token until logout clears it.
- Don't read the token from the store for network calls — use `getAuthToken()`, or just let the interceptor do it.
- `can()` returns `false` for an unauthenticated user and for a user with no roles; it never throws.
- Permission strings passed to `can()` are unprefixed by convention. Passing `admin-members-list` without `prefixed: true` will silently never match.
- `AuthWrapper` renders `null` before hydration — anything that must paint on the very first frame cannot live inside it.

---

## 9. Endpoint summary

| Endpoint | Method | Auth | Returns |
| --- | --- | --- | --- |
| `/auth/recaptcha_check` | GET | none | `{ recaptchaRequired }` |
| `/auth/send_otp` | POST | none | — (429 when rate-limited) |
| `/auth/login` | POST | none | `{ tempToken, user }` |
| `/auth/2fa/setup` | GET | `temp_token` | `{ secret, qrCode }` |
| `/auth/2fa/enable` | POST | `temp_token` | `{ accessToken, user }` |
| `/auth/logout` | POST | `accessToken` | — |
