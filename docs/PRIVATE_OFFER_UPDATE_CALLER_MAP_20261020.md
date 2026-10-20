# Private-offer Website UPDATE caller map

20 October 2026. Source trace only; no database mutations. Canonical root Website JS/MJS/HTML examined, excluding legacy backups/public mirrors. Server, Edge and RPC writers require the backend owner's separate trace.

| Source | Direct client payload |
| --- | --- |
| js/sponsorLogic.js:12 | archived: true |
| js/sponsorOffers.js:1273 | sponsor_live_confirmed: true; stage: 4; status: completed |
| js/sponseeOffers.js:1381 | status: accepted; stage: 2 |
| js/sponseeOffers.js:1396 | status: rejected |
| js/sponseeOffers.js:1416 | stage: 3; creation_date: selectedDate |
| js/sponseeOffers.js:1446 | stage: 4; status: live; sponsee_live_confirmed: true; live_url; live_date; live_urls; url_dates |
| js/reviewPage.js:254 | status: review_completed |
| js/reviewPage.js:266 | status: review_completed; archived: true |

No direct ordinary-client UPDATE of active, deadline, payment/identity/source fields, or description/instructions terms was found in these canonical sources. Fields can still appear on INSERT or in internal server paths. creation_date is a selected production date in the stage-3 caller; live_date/url_dates are publication dates. Archived changes occur on sponsor archive and review closeout.

adminLogic.js:590 update(changes) targets users_extended_data, not private_offers. No additional generic private-offer UPDATE helper was found in the examined canonical modules. This does not certify dormant legacy scripts or server workers. Client completed/review labels are not evidence of payment, settlement or funding.

## Browser notification migration status

Public application notifications already moved to the canonical server trigger; both client producers were removed in d935a11. Remaining direct browser producers are NOT migrated by the HTML fix:

- js/alerts.js:421: insertNotification writes notification_uuid, email, type, title, message, read, related_offer_id and created_at. Comment/offer/review wrappers resolve recipients through users_extended_data; cross-owner reads may fail under current RLS.
- js/friendGroups.js:277: direct insert fallback after dynamic alerts import; same fields. Group invitation wrapper starts285.
- js/groupOffers.js:16,27: direct fallback inserts, including legacy user_id/is_read and notification_uuid/email/is_read forms.
- js/adminLogic.js:1031: admin broadcast inserts selected recipient inboxes with type admin, title, message, read and created_at. Preserve this as an explicitly authorized server/Admin operation when direct inserts are removed.

A blanket self-recipient rule would break intended cross-recipient notices. Backend should derive recipients/content from proven domain events and provide its final producer contract before Website migration. No RLS, DDL or notification producer changes are part of this HTML patch.
