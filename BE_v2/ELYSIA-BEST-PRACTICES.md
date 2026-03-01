# ElysiaJS Best Practices

This document outlines the best practices and patterns discovered during development of WisdomLinked.

## Authentication Middleware

### Use Scoped Derivation
Always use `{ as: 'scoped' }` when creating authentication middleware to prevent ElysiaJS from deduplicating the derivation across routes.

```typescript
export const requireAuth = new Elysia()
  .derive({ as: 'scoped' }, async ({ headers, set }) => {
    // Auth logic here
  });
```

### Handle Auth Failures Directly
Throw errors directly in `.derive()` instead of using `onBeforeHandle`. This is cleaner and more reliable.

```typescript
.derive({ as: 'scoped' }, async ({ headers, set }) => {
  if (!authHeader) {
    set.status = 401;
    throw new Error("Unauthorized: Authentication required");
  }
  // Continue with auth logic
});
```

### Avoid Named Plugins for Reusable Middleware
Don't use `name` parameter in middleware that will be reused across multiple routes, as it causes deduplication.

```typescript
// ❌ BAD - Gets deduplicated
export const authPlugin = new Elysia({ name: "auth" })
  .derive(/* ... */);

// ✅ GOOD - Runs on every use
export const requireAuth = new Elysia()
  .derive({ as: 'scoped' }, /* ... */);
```

## Controller Pattern

### Each Controller is an Elysia Plugin
Every controller function should be an independent Elysia instance with middleware and validation inline.

```typescript
export const getUsersController = new Elysia()
  .use(requireAdmin)
  .get("/", async (context) => {
    // Handler logic
  }, {
    // Inline validation
    query: t.Object({
      page: t.Optional(t.String()),
    }),
  });
```

### Controllers Define Their Paths
Controllers should define their full endpoint path (e.g., `/`, `/:id`, `/my-sessions`).

```typescript
// Controller defines the specific path
export const getUserByIdController = new Elysia()
  .use(requireAdmin)
  .get("/:id", async ({ params }) => {
    // Handler logic
  });
```

## Route Mounting

### Use Prefix for Route Groups
Routes should use `new Elysia({ prefix })` to set the base path for all controllers.

```typescript
export const userRoutes = new Elysia({ prefix: "/api/v1/users" })
  .use(getAllUsersController)
  .use(new Elysia({ prefix: "/:id" }).use(getUserByIdController));
```

### Direct Mounting for Base Paths
When a controller's path is `/`, mount it directly without an additional wrapper.

```typescript
// ✅ GOOD - Direct mount for base path
export const logsRoutes = new Elysia({ prefix: "/api/v1/logs" })
  .use(getLogsController);  // Controller defines GET /

// ❌ BAD - Unnecessary wrapper
export const logsRoutes = new Elysia({ prefix: "/api/v1/logs" })
  .use(new Elysia({ prefix: "/" }).use(getLogsController));
```

### Use Prefix Wrapper for Sub-Paths
When mounting a controller at a sub-path, wrap it with a prefixed Elysia instance.

```typescript
export const sessionRoutes = new Elysia({ prefix: "/api/v1/sessions" })
  .use(new Elysia({ prefix: "/my-sessions" }).use(getUserSessionsController))
  .use(new Elysia({ prefix: "/:sessionId" }).use(revokeSessionController));
```

## Input Validation

### Use Inline TypeBox Validation
Define validation schemas inline as the second parameter to route handlers.

```typescript
export const createUserController = new Elysia()
  .use(requireAdmin)
  .post("/", async ({ body, set }) => {
    // Handler logic
  }, {
    body: t.Object({
      username: t.String({ minLength: 3, maxLength: 50 }),
      email: t.String({ format: "email" }),
      password: t.String({ minLength: 8 }),
    }),
  });
```

### Validation Order
```typescript
{
  params: t.Object({ /* ... */ }),  // URL parameters
  query: t.Object({ /* ... */ }),   // Query strings
  body: t.Object({ /* ... */ }),    // Request body
}
```

## Error Handling

### Use Proper Type Checks
Always check if error is an instance of Error before accessing properties.

```typescript
try {
  // Logic
} catch (error) {
  if (error instanceof Error) {
    set.status = 500;
    return { error: "Failed", message: error.message };
  }
  set.status = 500;
  return { error: "Failed", message: "Unknown error" };
}
```

### Set Status Before Returning
Always set the status code before returning an error response.

```typescript
if (!user) {
  set.status = 404;
  return { error: "User not found" };
}
```

## Logging

### Use Structured Logging
Always pass an object with relevant context to logging functions.

```typescript
await logInfo("Session revoked", { 
  sessionId, 
  userId: user.userId 
});
```

### Log Errors with Stack Traces
Include the error stack trace when logging errors.

```typescript
catch (error: any) {
  set.status = 500;
  logError(`Error in controller: ${error.message}`, error.stack);
  return { error: "Operation failed", message: error.message };
}
```

## Summary of Key Patterns

1. **Scoped Derivation**: Always use `{ as: 'scoped' }` for middleware
2. **No Named Plugins**: Avoid `name` parameter for reusable middleware
3. **Direct Auth Failures**: Throw errors in `.derive()`, not `onBeforeHandle`
4. **Plugin Controllers**: Each controller is an Elysia plugin
5. **Inline Validation**: Use TypeBox validation inline with handlers
6. **Direct Mounting**: Mount controllers directly when their path is `/`
7. **Prefix Wrappers**: Use prefix wrappers for sub-paths
8. **Type-Safe Errors**: Always check `instanceof Error`
9. **Structured Logging**: Pass objects to logging functions

