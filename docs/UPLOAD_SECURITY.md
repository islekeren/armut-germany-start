# Upload security (ARM-41/42)

Implemented on `codex/arm-41-42-upload-security`. ARM-43 account-deletion/retention cleanup is excluded.

## Storage and enabling private features

`S3_BUCKET` / `S3_PUBLIC_URL` remain the public image store. `S3_PRIVATE_BUCKET` must name a **different, non-public bucket** on the same S3 endpoint. Documents, message attachments and all presigned quarantine objects use this private bucket. Missing/same-bucket configuration rejects these operations with 503; there is no public fallback. Do not configure the private bucket in production until its access checks below pass.

S3: enable Block Public Access for the private bucket and deny anonymous object reads in bucket policy; remove public ACLs/policies and CDN mappings. R2: disable r2.dev and custom public domains on this bucket. API credentials need scoped GetObject/PutObject/DeleteObject access to both buckets. Configure CORS on private storage only for the intended browser origins and presigned PUTs. CORS is not authorization.

Configure lifecycle expiration for the `quarantine/` prefix after **one day**, including non-current versions if versioning is enabled and aborting incomplete multipart storage uploads. Finalization tries to delete staging content immediately; a failed deletion or replay of an unexpired signed PUT can recreate staging content. Lifecycle provides the cleanup backstop. Pending records expire after ten minutes; processing failures are stored as rejected. A crash during processing never makes that record readable. The record/allowance data is not an account-deletion cleanup workflow.

## Contracts

- Multipart profile/portfolio/request responses preserve public image URLs. Image bytes are decoded and re-encoded, so hashes, metadata and sizes may change; suffixes are canonical `.jpg`, `.png`, `.webp`.
- Documents/message responses return the private **object key** in both `key` and `url`. Store the key as the reference; never persist signed read URLs. Provider documents and message associations must refer to verified objects owned by the caller.
- `GET /api/uploads/read/:key` requires a JWT and returns `{url, expiresIn: 300}` with `Cache-Control: private, no-store`. URL-encode the key. Documents allow owner/admin. Messages allow only participants of a conversation containing that attachment, including no blanket admin bypass. An unattached message object cannot be read.
- Private signed downloads expire after five minutes and use attachment disposition and no-store caching. Existing links can remain usable until their TTL after an association/membership changes; this is the intentional short-lived capability window.
- `POST /api/uploads/presigned` returns `{uploadUrl, key, expiresIn: 600}`. There is **no publicUrl**. PUT bytes using the declared Content-Type, then `POST /api/uploads/finalize` with `{key}`. Only the owner can finalize a pending, unexpired reservation. Finalization streams at most the folder limit, validates actual content and writes a separate destination object. Only its successful response can be associated with a profile/request/message. Finalization is single-use; replaying the staging PUT cannot overwrite the validated destination. For a lost finalize response, re-upload instead of retrying a consumed key.
- PDFs using compressed object/xref streams (including escaped PDF names) are rejected before parsing. Classic PDFs with compressed image/content streams remain supported. Parsing runs in a worker with a two-second deadline and V8 heap limits; these limits are not a total RSS bound. PDFs are parsed and accepted only in private folders and delivered as downloads. This is format validation, not antivirus scanning or PDF active-content sanitization.
- No rendered frontend currently calls the presigned or message-attachment upload helpers; updated helpers support finalization and authenticated reads. Clients outside this repo must adapt to the private-key/finalize contracts before rollout.

## Abuse bounds

Multer enforces file sizes during ingestion: profile 5 MiB, portfolio/request/message 10 MiB, document 20 MiB. Each multipart HTTP body requires Content-Length and is capped at 30 MiB before buffering; chunked multipart bodies are rejected with 411. Browser FormData supplies Content-Length. Non-file fields are rejected and file/part counts are bounded. JSON presigned/finalize DTOs have bounded key/filename lengths.

Decoded images are limited to 25 million pixels, allow JPEG/PNG/WebP only, reject malformed/animated content and strip metadata/trailing content by re-encoding. An allowed MIME label cannot make HTML or a truncated image valid.

Each account has at most 100 upload reservations and 200 MiB of reserved bytes per rolling 24 hours, and 1 GiB of live reserved storage. Reservations charge the full folder maximum, including failed content validation, not just the actual file bytes; this intentionally conservative allowance bounds abuse and concurrent finalizations. Deletion does not reset daily allowance. A PostgreSQL user-row lock serializes admission across API instances. Existing HTTP IP throttling remains in place. Presigned PUT cannot impose a storage-ingestion byte maximum, so staging must stay private and lifecycle-bounded; finalize checks Content-Length and actual streamed bytes before publication.

## Existing object migration and production evidence

New code cannot revoke existing public URLs or infer production ACLs. Before enabling private features:

1. Inventory `documents/` and `messages/` in the old public bucket, including orphaned objects and cached/CDN copies. Restrict anonymous access immediately or keep private upload/consumption disabled.
2. Move needed objects into private storage, validate content and create ready UploadAsset ownership records. Replace Provider.documents/Message.attachments URL references with keys. Do not mark unvalidated legacy content ready; do not backfill arbitrary external URLs. Remove old public copies, old versions and CDN caches after verification.
3. Check known private keys anonymously against the storage endpoint and **every formerly public domain/CDN**, including old URLs; expect denial or missing content. Check quarantine keys similarly, and verify they cannot be associated before finalization.
4. Check authorized owner/admin document reads, both message participants, outsider/anonymous denial, expiry after 300 seconds and public profile/request images.
5. Record environment, commit, storage policy/lifecycle configuration and dated results. Keep private configuration unset until these checks pass.

The local Adobe S3 mock exercises SDK operations, ownership, finalization and PostgreSQL allowance concurrency; it does **not enforce production bucket ACLs or signed URL expiry**. A local MinIO image pull was denied by the configured registry. Production credentials were not available, so no live-storage privacy/expiry or legacy-object migration claim is made.

## Validation

Unit suites cover actual image/PDF content, private authorization, bounded quarantine reads and middleware rejection. Upload/authorization e2e cover both paths, normalized extensions, forged MIME, oversize content, finalize replay, private association and concurrent account reservations. See the task result for final commands/counts.

Verified on 2026-10-14:

- API unit: 43 suites / 411 tests passed.
- API full e2e: 15 suites / 321 tests passed; final upload-only rerun: 17 passed.
- Web unit: 9 suites / 62 tests passed.
- Chromium production-build smoke: 10 passed (native Chromium/ffmpeg, isolated `machma_e2e_web`, `E2E_SKIP_BUILD=true` after the successful root build).
- Root lint, build and check-types passed. Lint retains 12 pre-existing API warnings; no new warnings remain.
- Independent code review found PDF decompression and finalize/delete races; regression tests now cover both fixes. Re-review reported no remaining actionable findings.

Test-environment setup issues were resolved: test SQL mount readability, npm cache location and missing Playwright ffmpeg were corrected without product behavior changes. An overlapping Next build failed during smoke preparation; the final root build and sequential smoke run passed. An existing private mock bucket initially broke repeated setup; setup now tolerates only `BucketAlreadyOwnedByYou` and still fails on other storage errors.
