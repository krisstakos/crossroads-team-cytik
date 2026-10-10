---
name: backend-api
description: Design and implement backend HTTP/RPC endpoints — routing, request validation, error responses, auth checks, pagination, idempotency. Use when adding or changing an API route, handler, controller, or service-layer endpoint.
---

# Backend API work

## Before writing code
1. Detect the stack: read the manifest (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, etc.) and find existing routes. Match their framework, layering, and naming. Do not introduce a new framework or pattern when one exists.
2. Find an existing endpoint of the same kind and copy its shape (handler → service → data access, error format, test layout).
3. If the endpoint is public or changes a contract, check for an OpenAPI spec or client types and update them too.

## Implementation rules
- **Validate at the boundary.** Parse and validate every input (body, query, path, headers) with the project's validation library before it reaches business logic. Reject unknown or malformed input with 400/422; never trust types from the client.
- **Keep handlers thin.** Handler: parse → authorize → call service → map result to response. Business rules live in the service layer; SQL lives in the data layer.
- **Authorize per resource.** Check that the caller may act on *this* object, not just that they are logged in. Default to deny.
- **Consistent errors.** Use one error envelope across the API (match the existing one). Return the right status: 400 bad input, 401 unauthenticated, 403 forbidden, 404 not found (also for objects the caller may not see), 409 conflict, 422 semantic, 429 rate limited, 500 never leaks internals.
- **Status codes and verbs.** POST creates (201 + Location where applicable), PUT/PATCH updates, DELETE is idempotent. GET has no side effects.
- **Pagination.** Any list endpoint is paginated with a hard max page size. Prefer cursor/keyset pagination over large `OFFSET`s for big or growing tables.
- **Idempotency.** For non-idempotent writes that clients may retry (payments, creates from forms), accept an idempotency key and make repeats return the original result.
- **Timeouts and limits.** Set request body size limits and outbound call timeouts. Never make unbounded calls in a request path.
- **No secrets or stack traces in responses or logs.** Log with request ID and the relevant identifiers, not raw bodies containing PII or tokens.

## Done checklist
- [ ] Input validated; invalid input returns the project's standard error shape
- [ ] Authorization checked per object, with a test for a forbidden caller
- [ ] Status codes match the table above
- [ ] List endpoints paginated with a max page size
- [ ] Tests added for success, validation failure, auth failure, and not-found
- [ ] Run the project's test and lint commands and report the actual output
