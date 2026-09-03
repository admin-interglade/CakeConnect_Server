# CakeConnect API - Endpoints Reference

- **Base URL:** `/api/v1`
- **Docs (Swagger):** `/docs`
- **Health:** `GET /health`
- **Response envelope (success):**
  ```json
  { "success": true, "message": "...", "data": {} | [] | null, "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }
  ```
- **Response envelope (error):**
  ```json
  { "success": false, "message": "Error message", "errors": [ { "path": "...", "message": "..." } ] }
  ```
- **Auth header:** `Authorization: Bearer <accessToken>`
- **Roles:** `ADMIN`, `SHOP_OWNER`, `SUPPORT_STAFF`
- **Dev OTP** (NODE_ENV=development): `123456`

---

## Authentication  `auth`

### POST `/api/v1/auth/send-otp` — Send OTP  (Rate limited)
Auth: **None**
Body:
```json
{ "mobileNumber": "10-digit" }
```

### POST `/api/v1/auth/verify-otp` — Verify OTP & login  (Rate limited)
Auth: **None**
Body:
```json
{
  "mobileNumber": "10-digit",
  "otp": "6-digit",
  "name": "optional",
  "deviceId": "optional",
  "fcmToken": "optional"
}
```
Returns: `accessToken`, `refreshToken`, `user`

### POST `/api/v1/auth/refresh-token` — Refresh access token
Auth: **None**
Body:
```json
{ "refreshToken": "string" }
```

### POST `/api/v1/auth/logout` — Logout
Auth: **None**
Body:
```json
{ "refreshToken": "string" }
```

### GET `/api/v1/auth/me` — Get current profile
Auth: **Authenticated (any)**

---

## Users  `users`

### POST `/api/v1/users` — Create user
Auth: **ADMIN**
Body:
```json
{
  "name": "string",
  "mobileNumber": "10-digit",
  "email": "optional email",
  "role": "ADMIN | SHOP_OWNER | SUPPORT_STAFF (optional)",
  "password": "min 6 chars (optional)"
}
```

### GET `/api/v1/users` — List users
Auth: **ADMIN, SUPPORT_STAFF**

### PATCH `/api/v1/users/profile` — Update own profile
Auth: **Authenticated (any)**
Body:
```json
{ "name": "optional", "email": "optional email", "profileImage": "optional url" }
```

### GET `/api/v1/users/:id` — Get user
Auth: **ADMIN, SUPPORT_STAFF**

### PATCH `/api/v1/users/:id` — Update user
Auth: **ADMIN**
Body:
```json
{ "name": "optional", "email": "optional", "role": "optional", "status": "ACTIVE|SUSPENDED|INACTIVE (optional)" }
```

### PATCH `/api/v1/users/:id/status` — Set user status
Auth: **ADMIN**
Body:
```json
{ "status": "ACTIVE | SUSPENDED | INACTIVE" }
```

---

## Shops  `shops`

### POST `/api/v1/shops` — Create shop
Auth: **ADMIN**
Body:
```json
{
  "shopCode": "2-20 chars",
  "shopName": "string",
  "ownerMobileNumber": "10-digit (optional)",
  "ownerName": "optional",
  "mobileNumber": "10-digit",
  "email": "optional",
  "address": "optional", "city": "optional", "state": "optional", "pincode": "optional",
  "gstin": "optional",
  "creditLimit": "number >= 0 (optional)",
  "priceListId": "uuid (optional)"
}
```

### GET `/api/v1/shops` — List shops  (owner sees own shops)
Auth: **Authenticated (any)**
Query: `page`, `limit`, `status=ACTIVE|SUSPENDED|INACTIVE`, `search`, `city`

### PATCH `/api/v1/shops/:id/status` — Set shop status
Auth: **ADMIN**
Body: `{ "status": "ACTIVE | SUSPENDED | INACTIVE" }`

### PATCH `/api/v1/shops/:id/credit-limit` — Set credit limit
Auth: **ADMIN**
Body:
```json
{ "creditLimit": 0, "creditBehavior": "WARN|BLOCK_ORDER (optional)" }
```

### POST `/api/v1/shops/:id/assign-owner` — Assign owner
Auth: **ADMIN**
Body: `{ "userId": "uuid" }`

### POST `/api/v1/shops/:id/assign-price-list` — Assign price list
Auth: **ADMIN**
Body: `{ "priceListId": "uuid" }`

### DELETE `/api/v1/shops/:id` — Delete shop
Auth: **ADMIN**

### GET `/api/v1/shops/:id` — Get shop
Auth: **Authenticated (any)**

### PATCH `/api/v1/shops/:id` — Update shop
Auth: **Authenticated (any, owner scope)**
Body:
```json
{
  "shopName": "optional", "mobileNumber": "optional 10-digit", "email": "optional",
  "address": "optional", "city": "optional", "state": "optional", "pincode": "optional", "gstin": "optional"
}
```

---

## Categories  `categories`

### GET `/api/v1/categories` — List categories
Auth: **Authenticated (any)**

### GET `/api/v1/categories/:id` — Get category
Auth: **Authenticated (any)**

### POST `/api/v1/categories` — Create category
Auth: **ADMIN**
Body:
```json
{
  "name": "string",
  "description": "optional",
  "imageUrl": "optional url",
  "leadTimeHours": "number >= 0 (optional)"
}
```

### PATCH `/api/v1/categories/:id` — Update category
Auth: **ADMIN**
Body:
```json
{ "name": "optional", "description": "optional", "imageUrl": "optional url or empty", "leadTimeHours": "optional", "isActive": "optional boolean" }
```

### DELETE `/api/v1/categories/:id` — Delete category
Auth: **ADMIN**

---

## Products  `products`

### GET `/api/v1/products` — List products
Auth: **Authenticated (any)**
Query: `page`, `limit`, `status=ACTIVE|INACTIVE|UNAVAILABLE`, `categoryId`, `search`

### GET `/api/v1/products/:id` — Get product
Auth: **Authenticated (any)**

### POST `/api/v1/products/:id/availability` — Set availability
Auth: **ADMIN**
Body: `{ "date": "ISO date", "available": true, "note": "optional" }`

### DELETE `/api/v1/products/:id/availability` — Clear availability
Auth: **ADMIN**
Body: `{ "date": "ISO date" }`

### POST `/api/v1/products` — Create product
Auth: **ADMIN**
Body:
```json
{
  "name": "string", "sku": "string", "categoryId": "uuid",
  "description": "optional", "imageUrl": "optional url",
  "unit": "default piece", "basePrice": ">= 0", "minimumOrderQuantity": "default 1", "packSize": "default 1"
}
```

### PATCH `/api/v1/products/:id` — Update product
Auth: **ADMIN**
Body:
```json
{ "name": "optional", "description": "optional", "imageUrl": "optional", "unit": "optional", "basePrice": "optional", "minimumOrderQuantity": "optional", "packSize": "optional", "status": "ACTIVE|INACTIVE|UNAVAILABLE (optional)", "categoryId": "optional uuid" }
```

### DELETE `/api/v1/products/:id` — Delete product
Auth: **ADMIN**

---

## Price Lists  `price-lists`

### GET `/api/v1/price-lists` — List price lists
Auth: **Authenticated (any)**

### GET `/api/v1/price-lists/:id` — Get price list
Auth: **Authenticated (any)**

### GET `/api/v1/price-lists/shops/:shopId/products/:productId` — Shop applicable price
Auth: **Authenticated (any)**

### POST `/api/v1/price-lists` — Create price list
Auth: **ADMIN**
Body:
```json
{
  "name": "string", "region": "optional", "description": "optional",
  "items": [ { "productId": "uuid", "price": ">= 0" } ]  // optional
}
```

### PATCH `/api/v1/price-lists/:id` — Update price list
Auth: **ADMIN**
Body: `{ "name": "optional", "region": "optional", "description": "optional", "isActive": "optional boolean" }`

### DELETE `/api/v1/price-lists/:id` — Delete price list
Auth: **ADMIN**

### POST `/api/v1/price-lists/:id/items` — Add items
Auth: **ADMIN**
Body: `{ "items": [ { "productId": "uuid", "price": ">= 0" } ] }`

### PATCH `/api/v1/price-lists/:id/items/:itemId` — Update item price
Auth: **ADMIN**
Body: `{ "price": ">= 0" }`

### DELETE `/api/v1/price-lists/:id/items` — Remove item
Auth: **ADMIN**
Body: `{ "productId": "uuid" }`

---

## Orders  `orders`

### GET `/api/v1/orders` — List orders
Auth: **Authenticated (any)**
Query: `page`, `limit`, `status=DRAFT|SUBMITTED|ACCEPTED|IN_PRODUCTION|DISPATCHED|DELIVERED|INVOICED|CANCELLED|NO_ORDER_PLACED`, `shopId`, `deliveryDate`, `search`

### POST `/api/v1/orders` — Create draft order (MOQ/availability/cutoff validated, price snapshotted)
Auth: **Authenticated (any)**
Body:
```json
{
  "shopId": "uuid",
  "deliveryDate": "ISO date",
  "notes": "optional",
  "items": [ { "productId": "uuid", "quantity": "int > 0", "notes": "optional" } ]
}
```

### POST `/api/v1/orders/repeat-last` — Repeat last order
Auth: **Authenticated (any)**
Body: `{ "shopId": "uuid", "deliveryDate": "ISO date", "sourceOrderId": "optional uuid" }`

### POST `/api/v1/orders/repeat-weekday` — Repeat weekday order
Auth: **Authenticated (any)**
Body: `{ "shopId": "uuid", "deliveryDate": "ISO date", "sourceOrderId": "optional uuid" }`

### GET `/api/v1/orders/:id` — Get order
Auth: **Authenticated (any)**

### PATCH `/api/v1/orders/:id` — Update draft
Auth: **Authenticated (any)**
Body: `{ "notes": "optional", "deliveryDate": "optional date", "items": [ { "productId": "uuid", "quantity": "int > 0", "notes": "optional" } ] }`

### DELETE `/api/v1/orders/:id` — Delete draft
Auth: **Authenticated (any)**

### POST `/api/v1/orders/:id/submit` — Submit order
Auth: **Authenticated (any)**

### POST `/api/v1/orders/:id/cancel` — Cancel order
Auth: **Authenticated (any)**

### PATCH `/api/v1/orders/:id/status` — Transition status (admin/staff)
Auth: **ADMIN, SUPPORT_STAFF** (implied by route; see code)
Body: `{ "status": "ACCEPTED | IN_PRODUCTION | DISPATCHED | DELIVERED | INVOICED" }`

---

## Cutoff  `cutoff`

### GET `/api/v1/cutoff/global` — Get global cutoff
Auth: **Authenticated (any)**

### GET `/api/v1/cutoff/holidays` — List holidays
Auth: **Authenticated (any)**

### GET `/api/v1/cutoff/shops/:shopId/effective` — Get effective shop cutoff
Auth: **Authenticated (any)**

### POST `/api/v1/cutoff/global` — Set global cutoff
Auth: **ADMIN**
Body: `{ "cutoffTime": "HH:MM (24h)" }`

### POST `/api/v1/cutoff/shops` — Set shop cutoff
Auth: **ADMIN**
Body: `{ "shopId": "uuid", "cutoffTime": "HH:MM" }`

### POST `/api/v1/cutoff/date` — Set date cutoff override
Auth: **ADMIN**
Body: `{ "date": "ISO date", "cutoffTime": "HH:MM" }`

### POST `/api/v1/cutoff/holidays` — Add holiday
Auth: **ADMIN**
Body: `{ "date": "ISO date", "name": "string", "isNonDeliveryDay": "bool default false" }`

### DELETE `/api/v1/cutoff/holidays/:id` — Delete holiday
Auth: **ADMIN**

---

## Production Plans  `production-plans`

### GET `/api/v1/production-plans` — List plans
Auth: **Authenticated (any)**

### GET `/api/v1/production-plans/date/:date` — Get plan by date
Auth: **Authenticated (any)**

### GET `/api/v1/production-plans/date/:date/export` — Export plan (CSV)
Auth: **Authenticated (any)**

### GET `/api/v1/production-plans/:id` — Get plan
Auth: **Authenticated (any)**

### POST `/api/v1/production-plans/generate` — Generate plan
Auth: **ADMIN, SUPPORT_STAFF**
Body: `{ "productionDate": "ISO date" }`

### PATCH `/api/v1/production-plans/:id` — Update plan
Auth: **ADMIN, SUPPORT_STAFF**
Body:
```json
{ "status": "DRAFT|CONFIRMED|IN_PRODUCTION|COMPLETED (optional)", "items": [ { "productId": "optional uuid", "itemId": "optional uuid", "requiredQuantity": "optional >=0", "producedQuantity": "optional >=0" } ] }
```

---

## Deliveries  `deliveries`

### GET `/api/v1/deliveries` — List deliveries
Auth: **Authenticated (any)**
Query: `page`, `limit`, `status=PENDING|IN_TRANSIT|DELIVERED|PARTIALLY_DELIVERED|FAILED`, `deliveryDate`

### POST `/api/v1/deliveries` — Create delivery
Auth: **ADMIN, SUPPORT_STAFF**
Body: `{ "orderId": "uuid", "deliveryDate": "ISO date", "notes": "optional" }`

### GET `/api/v1/deliveries/:id` — Get delivery
Auth: **Authenticated (any)**

### POST `/api/v1/deliveries/:id/dispatch` — Mark dispatched
Auth: **ADMIN, SUPPORT_STAFF**
Body: `{ "notes": "optional" }`

### POST `/api/v1/deliveries/:id/deliver` — Mark delivered
Auth: **ADMIN, SUPPORT_STAFF**
Body:
```json
{
  "receivedBy": "optional",
  "notes": "optional",
  "items": [ { "productId": "uuid", "deliveredQuantity": "int >= 0", "shortSupplyReason": "optional" } ]
}
```

---

## Invoices  `invoices`

### GET `/api/v1/invoices` — List invoices
Auth: **Authenticated (any)**
Query: `page`, `limit`, `status=DRAFT|ISSUED|PARTIALLY_PAID|PAID|OVERDUE|CANCELLED`, `shopId`, `from`, `to`

### GET `/api/v1/invoices/shops/:shopId` — Shop invoices
Auth: **Authenticated (any)**

### GET `/api/v1/invoices/:id` — Get invoice
Auth: **Authenticated (any)**

### POST `/api/v1/invoices/:id/issue` — Issue invoice
Auth: **ADMIN**

### POST `/api/v1/invoices/:id/send` — Send invoice
Auth: **ADMIN**
Body: `{ "email": "valid email" }`

### POST `/api/v1/invoices` — Create invoice (network outstanding computed)
Auth: **ADMIN**
Body:
```json
{ "shopId": "uuid", "orderId": "uuid", "dueDate": "ISO date", "basedOnDelivered": "bool default true", "notes": "optional" }
```

---

## Payments  `payments`

### POST `/api/v1/payments/webhook` — Payment gateway webhook  (NO auth - bypasses)
Auth: **None**
Body:
```json
{
  "event": "string",
  "transactionId": "string",
  "paymentReference": "optional",
  "amount": "optional number",
  "status": "SUCCESS | FAILED | PENDING_CONFIRMATION",
  "signature": "optional",
  "data": "optional object"
}
```

### GET `/api/v1/payments` — List payments
Auth: **Authenticated (any)**
Query: `page`, `limit`, `status=PENDING|SUCCESS|FAILED|PENDING_CONFIRMATION|REJECTED|REFUNDED`, `shopId`, `paymentMethod=UPI|CARD|NET_BANKING|CASH|CHEQUE|NEFT`

### POST `/api/v1/payments/create` — Create payment (idempotent)
Auth: **Authenticated (any)**
Body:
```json
{
  "shopId": "uuid",
  "invoiceId": "optional uuid",
  "amount": "> 0",
  "paymentMethod": "UPI | CARD | NET_BANKING | CASH | CHEQUE | NEFT",
  "paymentDate": "optional date",
  "notes": "optional",
  "idempotencyKey": "optional"
}
```

### GET `/api/v1/payments/:id` — Get payment
Auth: **Authenticated (any)**

### POST `/api/v1/payments/:id/confirm` — Confirm payment (ledger + allocation + invoice in tx)
Auth: **ADMIN**
Body: `{ "notes": "optional" }`

### POST `/api/v1/payments/:id/reject` — Reject payment
Auth: **ADMIN**
Body: `{ "reason": "min 1 char" }`

---

## Ledger  `ledger`

### GET `/api/v1/ledger` — List ledger entries
Auth: **Authenticated (any)**
Query: `page`, `limit`, `shopId`, `from`, `to`

### GET `/api/v1/ledger/shops/:shopId/ledger` — Shop ledger
Auth: **Authenticated (any)**

### GET `/api/v1/ledger/shops/:shopId/outstanding` — Shop outstanding
Auth: **Authenticated (any)**

### POST `/api/v1/ledger/adjustments` — Add adjustment
Auth: **ADMIN**
Body:
```json
{ "shopId": "uuid", "amount": "number", "type": "ADJUSTMENT", "direction": "DEBIT | CREDIT", "description": "optional" }
```

### POST `/api/v1/ledger/credit-notes` — Add credit note
Auth: **ADMIN**
Body:
```json
{ "shopId": "uuid", "amount": "> 0", "reason": "string", "invoiceId": "optional uuid" }
```

---

## Offers  `offers`

### GET `/api/v1/offers` — List offers
Auth: **Authenticated (any)**
Query: `page`, `limit`, `status=ACTIVE|SCHEDULED|EXPIRED|WITHDRAWN`

### GET `/api/v1/offers/:id/view` — Track view
Auth: **Authenticated (any)**

### GET `/api/v1/offers/:id` — Get offer
Auth: **Authenticated (any)**

### POST `/api/v1/offers` — Create offer
Auth: **ADMIN**
Body:
```json
{
  "title": "string", "description": "optional", "bannerUrl": "optional url",
  "discountType": "PERCENTAGE | FLAT | BUY_X_GET_Y", "discountValue": ">= 0",
  "buyQuantity": "optional int", "getQuantity": "optional int",
  "startDate": "ISO date", "endDate": "ISO date",
  "status": "ACTIVE|SCHEDULED|EXPIRED|WITHDRAWN (optional)",
  "targetAllShops": "bool default true",
  "productIds": ["optional uuid"], "shopIds": ["optional uuid"], "regions": ["optional string"]
}
```

### PATCH `/api/v1/offers/:id` — Update offer
Auth: **ADMIN**
Body: (subset of create fields, all optional)

### POST `/api/v1/offers/:id/withdraw` — Withdraw offer
Auth: **ADMIN**
Body: `{ "reason": "optional" }`

---

## Notifications  `notifications`

### GET `/api/v1/notifications` — List notifications
Auth: **Authenticated (any)**
Query: `page`, `limit`, `type`, `unreadOnly`

### PATCH `/api/v1/notifications/read-all` — Mark all as read
Auth: **Authenticated (any)**

### GET `/api/v1/notifications/preferences` — Get preferences
Auth: **Authenticated (any)**

### PATCH `/api/v1/notifications/preferences` — Update preference
Auth: **Authenticated (any)**
Body:
```json
{
  "type": "CUT_OFF_REMINDER|ORDER_SUBMITTED|ORDER_ACCEPTED|ORDER_IN_PRODUCTION|ORDER_DISPATCHED|ORDER_DELIVERED|INVOICE_GENERATED|PAYMENT_SUCCESS|PAYMENT_FAILED|PAYMENT_OVERDUE|NEW_OFFER|CREDIT_LIMIT_WARNING",
  "push": "optional bool", "sms": "optional bool", "email": "optional bool"
}
```

### PATCH `/api/v1/notifications/:id/read` — Mark as read
Auth: **Authenticated (any)**

---

## Dashboard  `dashboard`

### GET `/api/v1/dashboard/shop-owner` — Shop owner dashboard
Auth: **Authenticated (any)**
Query: `period=TODAY|YESTERDAY|THIS_WEEK|THIS_MONTH|LAST_MONTH|CUSTOM`, `from`, `to`, `shopId`

### GET `/api/v1/dashboard/admin` — Admin dashboard
Auth: **ADMIN**
Query: `period=TODAY|YESTERDAY|THIS_WEEK|THIS_MONTH|LAST_MONTH|CUSTOM`, `from`, `to`, `shopId`

---

## Reports  `reports`

### GET `/api/v1/reports/sales` — Sales report
Auth: **Authenticated (any)**
Query: `from` (required date), `to` (default now), `shopId`, `format=json|csv`

### GET `/api/v1/reports/outstanding` — Outstanding report
Auth: **ADMIN**

### GET `/api/v1/reports/collections` — Collections report
Auth: **Authenticated (any)**
Query: `from` (required date), `to` (default now), `shopId`, `format=json|csv`

### GET `/api/v1/reports/cutoff-compliance` — Cutoff compliance report
Auth: **ADMIN**
Query: `from` (required date), `to` (default now), `shopId`, `format=json|csv`

---

## Audit Logs  `audit-logs`

### GET `/api/v1/audit-logs` — List audit logs
Auth: **ADMIN**
Query: `page`, `limit`, `actorId`, `action`, `entityType`, `entityId`
