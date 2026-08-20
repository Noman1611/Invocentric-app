# Security Specification for BillCraft Firestore

## Data Invariants
1. **User Ownership**: Every document in `items`, `customers`, `invoices`, `payments`, and `expenses` must belong to a valid `user_id` which matches the creator's `uid`.
2. **Immutable Identity**: Once created, the `user_id` of a document cannot be changed.
3. **Admin Privileges**: Users with `is_admin: true` in their `users` document can view and manage all data.
4. **Valid Relationships**: Invoices must reference valid `customer_id`s that belong to the same user.
5. **Terminal States**: Invoices marked as `paid` or `void` can only be updated by admins.
6. **Data Integrity**: All numeric fields (amount, price, stock) must be non-negative.
7. **Identity Protection**: Users can only read and write their own profile in the `users` collection.

## The Dirty Dozen (Malicious Payloads)
1. **The Spoof**: Creating an invoice with `user_id` of another user.
2. **The Hijack**: Updating an existing invoice to change its `user_id` to the attacker's id.
3. **The Shadow Field**: Adding a `is_verified: true` field to a user profile to bypass verification checks.
4. **The Negative Price**: Creating an item with price `-100`.
5. **The Orphan**: Creating an invoice for a customer ID that doesn't exist.
6. **The Admin Escalation**: Setting `is_admin: true` on your own user profile.
7. **The PII Leak**: Querying the `users` collection for another user's email.
8. **The State Skip**: Updating an invoice status from `draft` directly to `paid` without a recording a payment.
9. **The Oversized ID**: Using a 2MB string as a document ID.
10. **The Ghost Payment**: Creating a payment for an invoice that belongs to another user.
11. **The Time Warp**: Providing a future `created_at` timestamp.
12. **The Bulk Delete**: Attempting to delete all invoices in a single transaction (though rules usually handle per-doc).

## Security Test Runner Goal
Ensure all of the above payloads result in `PERMISSION_DENIED`.
