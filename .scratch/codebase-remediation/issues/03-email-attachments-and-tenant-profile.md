# 03: Outbound Email Attachments & Tenant Profile Resolution

**What to build:**
Reliable MIME-compliant email sending with file attachments and complete tenant branding resolution. Outbound quotation emails containing PDF proposals or binary attachments are compiled into RFC 2822 multipart messages without runtime type errors. Email template preview endpoints and automated Gmail webhook ingestion correctly look up tenant business profile records (official email, phone, logo, social links) to populate placeholder tokens.

**Blocked by:** 01: Authentication Signature Verification & Tenant Context Enforcement

**Status:** ready-for-agent

- [x] In `gmail-send-email.service.js`, attachment multipart segments are managed in an array and joined with `\r\n` (CRLF), preventing `TypeError: attachmentPart.push is not a function`.
- [x] Outbound emails with single and multiple binary attachments compile valid RFC 2822 multipart MIME payloads.
- [x] `quotation-email-template.controller.js` delegates tenant profile queries to `tenantProfileRepository.findByTenantId(tenantId)` without throwing `ReferenceError`.
- [x] `gmail-read-email.service.js` imports `PlaceHolderBuilder` and `tenantProfileRepository` properly, preventing `ReferenceError` during proposal draft creation.
- [x] `gmail-read-email.controller.js` `testprompt` sends a `200 OK` JSON response with generated details rather than hanging the client socket.
