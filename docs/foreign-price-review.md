# Foreign shop price corrections

Travel → Request a price update / review submissions lets signed-in users submit a known country/shop/item, a whole-dollar purchase price, observation date (last 30 days), notes, and a PNG/JPG/WebP screenshot up to 5 MB. The database limits each user to 5 attempts per rolling 24 hours, including incomplete drafts. No Torn requests are needed to submit evidence.

Evidence is in the private `foreign-price-evidence` bucket. Only its submitter and explicitly appointed reviewers can read it. Uploads cannot be replaced after submission. The review image uses a five-minute signed URL; anyone given that URL can access it until expiry, so do not share it. The interface advises cropping keys and personal details. Requests and evidence are retained as review history; account deletion de-identifies requests, rather than publishing their evidence.

The 230 bundled country/item observations seed `foreign_shop_references`. Approved changes update this backend table immediately, with an incremented revision. The Travel calculator refreshes it every minute while mounted and on refocus; explicit review invalidates the cache immediately. Valid Torn API shop prices still take precedence. Failure to fetch approved references shows a warning and falls back to the last cached or bundled observations. Stock counts and market resale quotes remain separate.

## Appoint the owner account

No reviewer is appointed automatically: neither a profile role nor user-editable metadata grants this permission. In Supabase SQL Editor, first find the website account by the owner's verified Torn ID:

```sql
select user_id, torn_id, torn_name
from public.linked_torn_accounts
where torn_id = YOUR_TORN_ID;
```

After checking the identity, grant just price-review access:

```sql
insert into public.foreign_price_reviewers(user_id)
select user_id from public.linked_torn_accounts
where torn_id = YOUR_TORN_ID
on conflict do nothing;
```

Refresh Travel; the owner queue appears inside the price-update section. Inspect each screenshot, enter the price to apply, optionally add a review note, then approve or reject. Corrections retain original/proposed/applied prices, reviewer UUID, evidence and timestamps. A request based on an older revision cannot overwrite a newer approved correction; reject it and request fresh evidence.

Revoke website reviewer access with `delete from public.foreign_price_reviewers where user_id = 'OWNER_AUTH_UUID';`. This never grants access to unrevealed campaign winners or other administrator capabilities.

## Database-owner review without a website reviewer

The database owner can inspect all requests in Supabase Table Editor. View screenshots in Storage → foreign-price-evidence. Approve or reject atomically in SQL Editor running directly as postgres (API service roles do not receive this bypass):

```sql
select id, country, shop, item_id, old_price, proposed_price, observed_on,
       notes, screenshot_path, status
from public.foreign_price_requests
where status = 'pending'
order by created_at;

-- NULL applies the user's proposed price; supply an integer to correct it.
select public.review_foreign_price_request(
  'REQUEST_UUID', true, null, 'Database owner: checked screenshot'
);
-- Rejection:
select public.review_foreign_price_request(
  'REQUEST_UUID', false, null, 'Reason for rejection'
);
```

Database-owner reviews have null reviewed_by when no app identity is present; their review note and timestamp are retained. Do not directly update shared references, since that would skip the approval history and revision guard.

## Validation

`npm test -- src/__tests__/foreign-price-review.test.ts src/__tests__/travel-profit.test.ts` covers permissions, private evidence, absent evidence, immutable client records, atomic approval, repeat/stale approvals, rejection, request rate limits, price range and image signatures. Bucket restrictions additionally enforce MIME types and file sizes on the storage server. Client file validation is convenience, not authorization.

Abandoned uploads remain bounded by the daily attempt limit and stay private. Database owners can remove abandoned evidence through the Storage API/dashboard before deleting its draft row; do not delete storage metadata directly through SQL.
