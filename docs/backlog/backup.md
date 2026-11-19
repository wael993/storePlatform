Implement Tenant-Level Backup System with Multiple Storage Providers
Summary

Implement an optional, plan-based backup system for the multi-tenant SaaS accounting application.

The application uses:

Node.js
Express.js
MongoDB
Mongoose
Multi-tenant architecture
Shared MongoDB collections across tenants
tenantId on tenant-owned documents

The backup system must create an isolated backup for a single tenant only. It must never expose, backup, restore, or modify data belonging to another tenant.

The backup architecture must be storage-provider agnostic and support the following three storage providers from the initial release:

Google Drive
Dropbox
Microsoft OneDrive

Each tenant can select which provider they want to use from the backup settings.

The architecture must also allow additional storage providers to be added later without modifying the core backup engine.

Business Goal

Provide customers with an optional backup feature that allows each organization/tenant to:

Enable or disable backups according to their subscription plan.
Select their preferred backup storage provider.
Connect their own storage account where required.
Store their backups in their selected storage destination.
Run an immediate/test backup manually.
Automatically create backups on a scheduled basis.
Keep a configurable number of recent backups.
Restore a selected backup manually.
Change the connected storage provider at any time.

The initial release must support:

Google Drive
Dropbox
Microsoft OneDrive
Scope
In Scope
Tenant-level backups.
Pluggable storage-provider architecture.
Google Drive provider.
Dropbox provider.
Microsoft OneDrive provider.
Provider-specific authentication/connection handling.
Automatic scheduled backups.
Manual/Test Backup.
Backup only when tenant data has changed.
dataVersion mechanism to detect data changes.
Backup queue and worker architecture.
BSON-based backup format.
Compression.
Encryption.
Backup manifest.
Backup retention.
Manual restore.
Safety backup before restore.
Strict tenant isolation.
Backup status and history.
Error handling and internal logging.
Out of Scope
Incremental backups.
Automatic restore.
Full MongoDB database backup.
Backup of all tenants in a single archive.
Local disk backup.
USB/HDD backup.
Media/file backup, since the current system does not store images, audio, video, or file attachments.

Additional storage providers may be added in the future using the same provider abstraction.

Multi-Tenant Backup Architecture

The application stores multiple tenants in the same MongoDB collections.

Example:

customers
products
sales
purchases
inventory
payments
expenses
...

Each tenant-owned document contains:

tenantId

A backup must contain only documents belonging to the requested tenant.

Example:

Tenant A
tenantId = A

Tenant B
tenantId = B

A backup for Tenant A must never contain:

tenantId = B

The system must not use a full mongodump of the entire database and then attempt to filter the result during restore.

Instead:

MongoDB
↓
Filter by tenantId
↓
Tenant-specific BSON archive
↓
Compression
↓
Encryption
↓
Selected Storage Provider
Storage Provider Architecture

The backup system must separate the backup engine from the storage provider.

The core backup process must not contain provider-specific logic.

Conceptually:

                    Backup Engine
                         │
                 Storage Provider
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼

GoogleDriveDriver DropboxDriver OneDriveDriver

The initial release must implement all three drivers:

GoogleDriveDriver
DropboxDriver
MicrosoftOneDriveDriver

Future providers can be added independently.

Examples:

GoogleDriveDriver
DropboxDriver
MicrosoftOneDriveDriver
S3Driver
AzureBlobDriver
...

Adding a new provider should not require changes to:

Backup generation.
BSON serialization.
Compression.
Encryption.
Queue processing.
Scheduler.
Tenant isolation.
Restore core logic.
Storage Provider Selection

Each tenant can select one storage provider from the backup settings.

Example:

Backup Provider

○ Google Drive
○ Dropbox
○ Microsoft OneDrive

The selected provider should be stored in the tenant's backup settings.

Example:

{
tenantId: ObjectId,

enabled: true,

provider: "google_drive",

providerConfig: {
// provider-specific configuration
},

retentionCount: 3
}

Possible provider values:

google_drive
dropbox
onedrive

The exact enum naming can be adapted to project conventions.

A tenant should have one active backup provider at a time.

The tenant can change the provider later from the settings page.

Storage Provider Interface

The core backup system should interact with a generic provider interface rather than directly with a specific provider.

The interface should conceptually support operations such as:

upload()
download()
delete()
testConnection()

Additional operations may be introduced if required by retention, restore, listing, or provider capabilities.

The Backup Worker should not contain logic such as:

if provider === "google_drive"
...
else if provider === "dropbox"
...
else if provider === "onedrive"
...

Instead, provider selection should resolve the appropriate driver through a provider factory/registry or equivalent abstraction.

Conceptually:

Backup Worker
↓
Provider Factory / Registry
↓
getDriver(provider)
↓
GoogleDriveDriver / DropboxDriver / OneDriveDriver
Provider Configuration

Backup settings should identify the selected provider independently from provider-specific configuration.

Suggested structure:

{
tenantId: ObjectId,

enabled: Boolean,

provider: "google_drive",

providerConfig: {
// provider-specific configuration
},

retentionCount: Number,

...
}

Provider-specific credentials/configuration must not leak into the core backup engine.

Provider Authentication

Authentication must be implemented according to the selected provider.

The system must support the authentication requirements of all three initial providers:

Google Drive
OAuth authorization.
Secure storage of OAuth credentials/tokens.
Token refresh where applicable.
Checking whether the connection is still valid.
Disconnecting/reconnecting.
Changing the connected Google Drive account.
Dropbox
Provider-supported authentication/authorization.
Secure storage of credentials/tokens.
Token refresh where applicable.
Checking whether the connection is still valid.
Disconnecting/reconnecting.
Changing the connected Dropbox account.
Microsoft OneDrive
Provider-supported authentication/authorization.
Secure storage of credentials/tokens.
Token refresh where applicable.
Checking whether the connection is still valid.
Disconnecting/reconnecting.
Changing the connected Microsoft account.

The core backup system must not assume that all providers use exactly the same authentication mechanism.

Provider-specific authentication logic must remain encapsulated within each provider implementation.

Storage Provider Security

Provider credentials and tokens must never be stored as plain, publicly accessible data.

They should be protected using the application's secure secret/encryption mechanism.

The system must ensure that one tenant cannot use another tenant's provider credentials or backup destination.

Provider-specific security requirements must be encapsulated within the corresponding provider implementation.

Backup Data Format

Do not use:

JSON.stringify()

for the actual MongoDB data archive.

The backup must preserve MongoDB native types such as:

ObjectId
Date
Decimal128
Other BSON-compatible types

Therefore, the backup should use a BSON-compatible/archive format.

Conceptually:

MongoDB Documents
↓
BSON
↓
Compression
↓
Encryption
↓
Backup Artifact
↓
Selected Storage Provider

The backup file itself must remain provider-independent.

A backup generated for Google Drive must be usable independently of Google Drive, subject to the backup format and encryption requirements.

Compression

The backup archive should be compressed before upload.

The exact compression algorithm can be selected during implementation based on:

Compression ratio
CPU usage
Streaming support
Node.js support
Restore performance

The implementation should preferably support streaming so that large tenant backups do not require loading the complete backup into RAM.

Encryption

Backup files should be encrypted before being uploaded to the selected storage provider.

A modern authenticated encryption algorithm such as:

AES-256-GCM

is appropriate.

If password-based encryption is used, a strong password-based key derivation mechanism such as:

Argon2id

or:

scrypt

should be considered.

The backup encryption design must ensure that:

Backup passwords/secrets are not stored in plain text.
Encryption keys are not stored inside the backup archive.
Encryption metadata required for decryption can be safely stored.
Authentication/integrity verification is performed during restore.

The exact key-management design should be finalized before implementation.

Backup Manifest

Each backup should contain a manifest describing the backup.

Example:

{
backupVersion: 1,
tenantId: ObjectId,
tenantName: "...",
createdAt: Date,
applicationVersion: "...",
collections: [
"customers",
"suppliers",
"products",
"sales",
"purchases",
"inventory",
"payments",
"expenses"
]
}

The manifest should contain only information necessary for backup/restore and diagnostics.

Do not include unnecessary sensitive information.

The manifest should allow the restore process to verify:

Backup format/version.
Tenant identity.
Backup creation date.
Included collections.
Application compatibility where applicable.
Collections Included in Backup

The backup system should maintain an explicit list/configuration of tenant-owned collections.

Potential examples:

customers
suppliers
products
sales
purchases
inventory
payments
expenses
...

System/global collections such as:

plans
subscriptions
countries
systemConfig
...

must not automatically be included.

Each collection must be classified as one of:

Tenant-owned and backed up.
Global/system data and not backed up.
Derived/cache data that can be regenerated.
Special-case data requiring separate handling.

Before implementation, the complete collection list must be reviewed.

Data Versioning
Decision

Use a dataVersion mechanism to determine whether tenant data has changed since the last successful backup.

This is the approved approach.

Create a dedicated collection/state record, for example:

TenantBackupState

Suggested structure:

{
tenantId: ObjectId,
dataVersion: Number,
lastBackupVersion: Number,
lastBackupAt: Date,
lastBackupStatus: String
}

Example:

dataVersion = 1542
lastBackupVersion = 1540

means the tenant has changed since the last successful backup and a new backup is required.

If:

dataVersion === lastBackupVersion

then a new automatic backup should normally be skipped.

Updating dataVersion

The existing backend contains a centralized mongodbController through which MongoDB operations are performed.

The preferred implementation is to integrate dataVersion handling into this existing database layer.

However, the exact implementation must be reviewed after inspecting the current mongodbController.

Important requirement:

No tenant data mutation should be able to occur without updating the tenant's dataVersion.

Operations that may require version updates include:

Create
Update
Delete
Bulk operations
Other operations that modify tenant-owned data

The implementation must avoid incrementing dataVersion unnecessarily for read-only operations.

Transaction / Atomicity Requirement

Where MongoDB transactions are used, the business data modification and dataVersion increment should be part of the same transaction.

Example:

Transaction
├── Modify tenant data
└── Increment dataVersion
↓
Commit

This prevents a situation where:

Business data changed
BUT
dataVersion was not updated

which could cause the backup scheduler to incorrectly skip a required backup.

The exact transaction strategy should be determined after reviewing the current mongodbController architecture.

Business Operation vs Individual DB Operation

If a single business operation modifies multiple collections, dataVersion should preferably be incremented once per business transaction rather than once for every individual query.

Example:

Create Sale
├── Create Sale document
├── Update Inventory
├── Update Customer Balance
└── Create Payment
↓
dataVersion +1

Not:

dataVersion +1
dataVersion +1
dataVersion +1
dataVersion +1

The exact implementation depends on the current database abstraction and transaction architecture.

Backup Eligibility

A tenant should be eligible for automatic backup when:

Backup is enabled.
The tenant's subscription/plan allows backup.
A storage provider is configured.
The provider connection is valid.
The scheduled backup time/window has been reached.
dataVersion > lastBackupVersion.

If:

dataVersion === lastBackupVersion

the backup should normally be skipped.

This avoids creating unnecessary backups for tenants that:

Were closed.
Had no activity.
Were closed during holidays.
Were closed during weekends.
Had no data changes since the previous backup.

The system does not need to maintain a business calendar just to determine whether a backup is necessary.

Backup Scheduler

The scheduler must not perform the actual backup operation.

Its responsibility is to identify eligible tenants and create backup jobs.

Architecture:

Scheduler
↓
Find eligible tenants
↓
Create Backup Jobs
↓
Queue

The scheduler should not attempt to start backups for all 4,000 tenants simultaneously.

Backup Queue and Workers

Use a queue/worker architecture.

Example:

Scheduler
↓
Backup Queue
↓
┌─────────┬─────────┬─────────┬─────────┐
│ Worker 1│ Worker 2│ Worker 3│ Worker N│
└─────────┴─────────┴─────────┴─────────┘

The number of concurrent workers should be configurable and tuned according to:

CPU
RAM
MongoDB capacity
Network bandwidth
Storage provider API limits
Backup size
Number of active tenants

An initial concurrency such as 5–20 workers can be considered, but this must be configurable rather than hard-coded.

Backup Scheduling Window

The system may have a default daily backup time around:

03:00

However, all tenants should not necessarily start at exactly 03:00.

The system should distribute backup jobs over a reasonable backup window.

Possible implementation:

nextBackupAt

per tenant, or scheduler-based distribution.

This prevents a "thundering herd" of approximately 4,000 tenants simultaneously querying MongoDB and uploading to storage providers.

Backup Job States

A backup job should support states such as:

PENDING
PROCESSING
UPLOADING
COMPLETED
FAILED

The exact queue implementation is open for technical design.

Manual / Test Backup

The settings page should provide a button similar to:

Test Backup

or:

Backup Now

When the customer clicks it:

Verify the tenant is allowed to use backup.
Verify backup is enabled.
Verify a storage provider is configured.
Verify the selected provider connection is valid.
Verify the destination is accessible.
Create a backup job for that tenant only.
Process the backup through the normal backup worker.
Store the resulting backup using the selected provider.
Return/display the backup result to the customer.

The manual backup must not start jobs for other tenants.

Storage Provider Switching

A tenant can change its selected storage provider from the settings page.

Example:

Current Provider:
Google Drive

[ Change Provider ]

Google Drive
Dropbox
Microsoft OneDrive

When changing providers:

The new provider must be authenticated/connected.
The new provider connection must be tested.
Future backups should use the new provider.
Existing backup records must retain the provider with which they were created.
Existing backups must remain associated with their original provider.
Restore must use the provider stored in the selected backup record.

Changing the active provider must not silently move or delete existing backups.

Migration of existing backups between providers is not required for this release.

Google Drive Integration

Google Drive is one of the three initial storage providers.

The implementation must support:

OAuth authorization.
Secure storage of OAuth credentials/tokens.
Token refresh where applicable.
Checking whether the connection is still valid.
Disconnecting/reconnecting.
Changing the connected Google Drive account.
Uploading backup artifacts.
Downloading backup artifacts for restore.
Deleting backup artifacts for retention.
Dropbox Integration

Dropbox is one of the three initial storage providers.

The implementation must support:

Provider-supported authorization.
Secure storage of credentials/tokens.
Token refresh where applicable.
Checking whether the connection is still valid.
Disconnecting/reconnecting.
Changing the connected Dropbox account.
Uploading backup artifacts.
Downloading backup artifacts for restore.
Deleting backup artifacts for retention.
Microsoft OneDrive Integration

Microsoft OneDrive is one of the three initial storage providers.

The implementation must support:

Provider-supported authorization.
Secure storage of credentials/tokens.
Token refresh where applicable.
Checking whether the connection is still valid.
Disconnecting/reconnecting.
Changing the connected Microsoft account.
Uploading backup artifacts.
Downloading backup artifacts for restore.
Deleting backup artifacts for retention.
Backup Model

A possible structure:

{
tenantId: ObjectId,

name: String,

provider: "google_drive",

status: String,

startedAt: Date,

completedAt: Date,

size: Number,

storageId: String,

createdAt: Date,

errorCode: String,

errorMessage: String
}

The actual schema may include additional fields required for restore, retention, auditing, and provider integration.

The provider field is mandatory so the system knows which driver must be used to retrieve the backup.

Backup Retention

Initial default:

Keep latest 3 successful backups

However, retention should be designed to support plan-based configuration.

Example:

Plus → 3 backups
Pro → 7 backups
Enterprise → 30 backups

These numbers are examples and can be finalized by product/business requirements.

Retention should normally apply to successful backups.

Failed jobs should not consume normal successful-backup retention slots unless explicitly required.

Retention operations must use the selected storage provider's driver.

Restore

Restore is a manual operation.

The customer should be able to select one of the available backups.

Example flow:

Settings
↓
Backups
↓
Select Backup
↓
Restore
↓
Safety Backup
↓
Validate Backup
↓
Download through Backup Provider Driver
↓
Decrypt
↓
Decompress
↓
Restore Tenant Data

There should be no automatic restore in this release.

Provider-Aware Restore

Every backup record must contain the storage provider used for that backup.

Example:

provider = google_drive

The restore process must use the corresponding provider driver:

Google Drive backup
↓
GoogleDriveDriver.download()

or:

Dropbox backup
↓
DropboxDriver.download()

or:

OneDrive backup
↓
OneDriveDriver.download()

The restore engine itself must remain provider-independent.

Safety Backup Before Restore

Before replacing/restoring tenant data, create a safety backup of the tenant's current data.

Example:

Current Tenant Data
↓
Safety Backup
↓
Restore Selected Backup

If the restore fails, the safety backup can be used to recover the previous state.

The safety backup must also be tenant-scoped and stored using the tenant's currently configured storage provider unless a different technical strategy is explicitly defined.

Restore Ordering

The restore implementation must account for dependencies between collections.

For example:

products
customers
suppliers
↓
sales
purchases
payments
inventory

The exact order must be determined after reviewing the application's MongoDB schemas and references.

Collections with references to other collections must be restored in a safe order.

Restore Strategy

The exact restore strategy should be designed carefully.

Possible approach:

Validate backup.
Verify tenant ID.
Verify backup format/version.
Create safety backup.
Start restore transaction where technically possible.
Restore collections in dependency order.
Validate restored documents.
Update tenant backup state.
Mark restore as successful.

For large backups, MongoDB transaction limitations and backup size must be considered.

The implementation must guarantee that a failed restore does not accidentally affect other tenants.

Backup Completion Logic

A successful backup should update the tenant state.

Example:

Before:

dataVersion = 1542
lastBackupVersion = 1540

After successful backup:

dataVersion = 1542
lastBackupVersion = 1542
lastBackupStatus = COMPLETED
lastBackupAt = current date

If the backup fails:

dataVersion = 1542
lastBackupVersion = 1540
lastBackupStatus = FAILED

The system must not set lastBackupVersion to the current dataVersion when the backup did not complete successfully.

This ensures the tenant will be retried later.

Backup Naming

Backup names should be human-readable and include enough information to identify the tenant and creation time.

Example:

TenantName_2026-10-04_03-15.backup

The exact naming convention can be finalized during implementation.

Do not rely on the file name alone for tenant identification. The manifest and database metadata must remain authoritative.

Customer UI

The settings area should expose backup configuration.

Potential UI:

## Backup

Status: Enabled

Provider:
Google Drive

Connected account:
customer@example.com

Last Backup:
04 Oct 2026 03:18
Successful

Next Backup:
05 Oct 2026 03:00

Retention:
3 backups

[ Backup Now ]

[ Restore ]

[ Change Provider ]

[ Disable Backup ]

The provider selector should allow the tenant to choose:

Google Drive
Dropbox
Microsoft OneDrive

The customer-facing UI should show simple operational information.

Technical stack traces, internal worker information, MongoDB errors, and sensitive details must not be exposed to customers.

Customer-Facing Backup Status

Customers should be able to see:

Backup status.
Backup name.
Backup date/time.
Backup size where useful.
Storage provider.
Success/failure.
Available restore points.

Internal logs may contain additional technical information.

Error Handling

Errors must be classified where practical.

Potential categories:

GOOGLE_AUTH_ERROR
GOOGLE_DRIVE_ACCESS_ERROR

DROPBOX_AUTH_ERROR
DROPBOX_ACCESS_ERROR

ONEDRIVE_AUTH_ERROR
ONEDRIVE_ACCESS_ERROR

MONGODB_ERROR
BACKUP_SERIALIZATION_ERROR
COMPRESSION_ERROR
ENCRYPTION_ERROR
UPLOAD_ERROR
RESTORE_VALIDATION_ERROR
RESTORE_ERROR
TENANT_VALIDATION_ERROR
SUBSCRIPTION_NOT_ALLOWED

Provider-specific errors should be normalized where practical so that the core backup system can handle them consistently.

Customer-facing messages should be understandable and should not expose internal implementation details.

Detailed technical errors should be logged internally.

Security Requirements

The backup system must enforce:

Tenant isolation.
Secure provider credentials/token storage.
Encrypted backup files.
No cross-tenant backup access.
No cross-tenant restore.
Backup manifest tenant validation.
Restore document tenantId validation.
Authorization checks on every backup/restore endpoint.
Subscription/feature entitlement checks.
Secure handling of encryption keys/passwords.
No sensitive credentials inside backup archives unless explicitly required.
No exposure of provider credentials to frontend clients beyond what is necessary for the provider authentication flow.
Scalability Requirements

The initial target is approximately:

4,000 tenants

The system must not:

Run 4,000 backups simultaneously.
Scan every tenant's full data to determine whether it changed.
Perform expensive collection scans just to determine backup eligibility.

Backup eligibility should primarily rely on:

TenantBackupState.dataVersion

which makes the check effectively O(1) per tenant.

The worker architecture must also account for API rate limits and concurrency restrictions of the selected storage provider.

Future Incremental Backup

Incremental backup is explicitly not required for this release.

The architecture should, however, avoid making future incremental backup impossible.

Potential future mechanisms include:

Change Log.
MongoDB Change Streams.
Per-document modification tracking.
Incremental backup versions.

For the initial implementation:

Changed tenant → Full tenant backup

No incremental implementation is required now.

Future Change Detection Alternatives

The following alternatives were considered but are not selected for the initial implementation:

lastModifiedAt

Could track:

lastDataChangeAt
lastBackupAt

and compare the timestamps.

Simple, but dataVersion provides clearer semantics and avoids some timestamp/concurrency concerns.

Change Log

Could record:

tenantId
collection
documentId
operation
createdAt

Useful for future incremental backup/auditing but adds storage and complexity.

MongoDB Change Streams

Could monitor database changes and update backup state automatically.

Powerful, but more complex operationally and unnecessary for the initial implementation.

Scanning Collections

Querying every collection for:

updatedAt > lastBackupAt

is not preferred because it becomes unnecessarily expensive as tenant count and data volume grow.

Recommended Processing Flow
Automatic Backup
Scheduled Window
↓
Scheduler
↓
Find tenants with:

- backup enabled
- plan allows backup
- provider configured
- provider connection valid
- dataVersion > lastBackupVersion
  ↓
  Create Backup Jobs
  ↓
  Queue
  ↓
  Workers
  ↓
  Read tenant data
  ↓
  Generate BSON archive
  ↓
  Compress
  ↓
  Encrypt
  ↓
  Resolve Storage Provider Driver
  ↓
  Upload to selected provider
  ↓
  Verify upload
  ↓
  Mark Backup COMPLETED
  ↓
  lastBackupVersion = dataVersion
  Manual Backup Flow
  Customer clicks "Backup Now"
  ↓
  Authorization / Plan validation
  ↓
  Validate selected provider connection
  ↓
  Create tenant-specific Backup Job
  ↓
  Queue
  ↓
  Worker processes job
  ↓
  Generate / Compress / Encrypt
  ↓
  Upload through selected provider driver
  ↓
  Update backup state
  Restore Flow
  Customer selects backup
  ↓
  Authorization
  ↓
  Validate backup metadata
  ↓
  Validate tenantId
  ↓
  Validate backup format/version
  ↓
  Resolve provider stored with backup
  ↓
  Download using provider driver
  ↓
  Create Safety Backup
  ↓
  Decrypt
  ↓
  Decompress
  ↓
  Restore tenant data
  ↓
  Validate restored data
  ↓
  Update backup state
  ↓
  Mark restore successful
  Important Technical Decisions to Review Before Implementation

Before writing the final implementation, inspect the current backend architecture, especially:

mongodbController
How create/update/delete operations are exposed.
Whether all write operations pass through mongodbController.
Existing MongoDB transaction usage.
Existing Mongoose models.
Existing tenantId enforcement.
All tenant-owned collections.
Collection relationships/references.
Existing job/queue infrastructure.
Existing authentication/authorization architecture.
Existing subscription/plan entitlement system.
Existing encryption/secret-management mechanisms.
Provider authentication architecture.
How provider-specific credentials/tokens will be securely stored.
Provider-specific API limitations and upload/download behavior.

The exact implementation of dataVersion should be decided after this review.

Acceptance Criteria
Backup Isolation

A backup contains data for exactly one tenant.

No document belonging to another tenant can be included.

Backup generation validates tenant ownership.

Change Detection

dataVersion exists per tenant.

Tenant data mutations increment dataVersion.

Read-only operations do not increment dataVersion.

lastBackupVersion is updated only after a successful backup.

Tenants with no changes since the last successful backup are skipped.

Failed backups remain eligible for retry.

Storage Providers

Google Drive is supported.

Dropbox is supported.

Microsoft OneDrive is supported.

Tenant can select one of the three providers.

Provider selection is stored per tenant.

Provider-specific authentication is implemented.

Provider credentials/tokens are stored securely.

Provider-specific logic is isolated inside its driver.

Core backup generation does not contain provider-specific upload/download logic.

Backup records store the provider used for each backup.

Restore uses the provider associated with the selected backup.

Retention uses the provider abstraction.

Adding another provider later does not require modifying the core backup engine.

Backup Format

MongoDB native BSON types are preserved.

Backup is compressed.

Backup is encrypted.

Backup contains a manifest.

Backup format/version can be validated during restore.

Scheduling

Scheduler creates backup jobs rather than executing backups directly.

Worker concurrency is configurable.

Approximately 4,000 tenants can be handled without starting all backups simultaneously.

Backup jobs support retry/failure handling.

Storage-provider API limits are respected.

Manual Backup

Customer can trigger a backup manually.

Manual backup is restricted to the current tenant.

Customer can use the currently selected storage provider.

Same backup pipeline is used for manual and scheduled backups.

Provider Switching

Customer can change the selected storage provider.

New provider must be connected and validated before activation.

Future backups use the new provider.

Existing backup records retain their original provider.

Existing backups are not silently moved or deleted when changing provider.

Restore uses the provider associated with each backup.

Retention

Default retention supports at least 3 successful backups.

Retention count is configurable.

Old backups are removed according to the configured retention policy.

Retention deletion uses the correct provider driver.

Restore

Customer can select a backup manually.

Safety backup is created before restore.

Backup tenant ID is validated.

Every restored document is tenant-validated.

Restore cannot modify another tenant.

Collection restore order respects application dependencies.

Failed restore does not silently report success.

Restore downloads through the provider associated with the backup.

Security

Cross-tenant access is prevented.

Provider credentials are protected.

Backup files are encrypted.

Restore endpoints enforce tenant authorization.

Technical errors are not exposed unnecessarily to customers.

Definition of Done

The feature is considered complete when:

A tenant can enable backup if permitted by its subscription plan.
The tenant can choose Google Drive, Dropbox, or Microsoft OneDrive.
The tenant can successfully connect and authorize the selected provider.
A manual backup can be triggered successfully.
The backup contains only that tenant's data.
MongoDB native data types are preserved.
The backup is compressed and encrypted.
The backup is uploaded successfully to the selected provider.
Automatic scheduling works through a queue/worker architecture.
Tenants without data changes are skipped.
dataVersion reliably detects tenant data changes.
Backup retention works for all three providers.
Backup history/status is visible to the customer.
A customer can manually restore a selected backup.
Restore correctly retrieves the backup from its original provider.
A safety backup is created before restore.
Restore cannot affect another tenant.
Failed backups/restores are correctly reported and logged.
The system is tested with all three storage providers.
The system is suitable for approximately 4,000 tenants without launching all backups simultaneously.
The core backup engine remains independent of provider-specific APIs.
A future storage provider can be added without redesigning the core backup engine.
