# Public-offer stored HTML rendering fix

Applicant message/username and offer display fields entered innerHTML without escaping. Applicant usernames were also embedded in an inline JavaScript string; encodeURIComponent leaves apostrophes and does not make a JavaScript string boundary safe.

Applicant rows now use createElement/textContent and closure-bound View Profile/Accept/Remove controls. Existing IDs and availability/status gating remain. Rows construct no innerHTML or inline event attributes. Avatars use URL validation and DOM src assignment.

Sponsor/creator offer cards, details modal and apply modal escape39stored display interpolations. Storage image URLs and sponsor logos are URL-validated and attribute-escaped. Finder company text and offer-image attributes are escaped. Existing server apply/accept RPCs, funding-review gate and canonical application notifications are unchanged. No RLS widening or DDL.

Five focused tests passed: literal row text, callbacks/gating, image scheme/attribute safety, actual sponsor/creator card templates, actual details/apply modal templates. Local Website check used benign literal b-tags with fictional data: applicant/offer details display tags as text; applicant b-node count0; View Profile builds the expected URL. No payload was inserted into live data, and no live application was accepted or removed.

Runtime publication proof and local screenshot are in the external Website evidence packet. This scoped fix does not certify every stored-HTML sink elsewhere on the Website.
