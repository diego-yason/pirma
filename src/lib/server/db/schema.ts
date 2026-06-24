import {
    bigint,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    pgView,
    text,
    timestamp,
    uuid,
    unique,
} from "drizzle-orm/pg-core";
import { eq, inArray, sql } from "drizzle-orm";
import { user } from "./auth.schema";

// cryptograph keys
export const cryptoKeys = pgTable(
    "user_keys",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id),
        pkey: text("pkey").notNull(),
        pubkey: text("pubkey").notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        revokedAt: timestamp("revoked_at"),
    },
    (table) => [index("user_keys_user_id_idx").on(table.userId)],
).enableRLS();

// public: shows hash, actual PDF, and signatures with signer info
// restricted: shows hash and signatures as "validated" unless logged in
export const viewAccessEnum = pgEnum("view_access", ["public", "restricted"]);

// draft = being edited, not ready for signing
// finalized = ready for signing, invitations sent
// executed = fully signed and completed, no more changes allowed. deletion prohibited.
export const documentStatusEnum = pgEnum("document_status", ["draft", "finalized", "executed"]);

export const documents = pgTable(
    "documents",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        title: text("title").notNull(),
        owner: text("owner")
            .notNull()
            .references(() => user.id),
        detailedViewAccess: viewAccessEnum("detailed_view_access").notNull().default("restricted"),
        hash: text("hash").notNull(),
        status: documentStatusEnum("status").notNull().default("draft"),
        pageCount: integer("page_count"),
        fileSize: bigint("file_size", { mode: "number" }),
        storagePath: text("storage_path"),
        placementFields: jsonb("placement_fields"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        index("documents_owner_idx").on(table.owner),
        index("documents_status_idx").on(table.status),
    ],
).enableRLS();

// for actual signing
// pending = signature request sent, waiting for blockchain
// signed = signature confirmed on blockchain
// anchored = signature is anchored on public blockchain
// rejected = signature request rejected by signer
export const signaturesStatus = pgEnum("signature_status", [
    "pending",
    "signed",
    "anchored",
    "rejected",
]);

export const recipientRoleEnum = pgEnum("recipient_role", ["signer", "viewer"]);

export const packageRecipients = pgTable(
    "package_recipients",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        packageId: uuid("package_id")
            .notNull()
            .references(() => packages.id),
        userId: text("user_id").references(() => user.id),
        name: text("name"),
        email: text("email"),
        role: recipientRoleEnum("role").notNull().default("signer"),
        recipientId: integer("recipient_id"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        unique("package_recipients_unique").on(table.packageId, table.email),
        index("package_recipients_package_id_idx").on(table.packageId),
        index("package_recipients_user_id_idx").on(table.userId),
    ],
).enableRLS();

export const signatures = pgTable(
    "signatures",
    {
        txId: text("tx_id").primaryKey(),
        documentId: uuid("document_id")
            .notNull()
            .references(() => documents.id),
        documentHash: text("document_hash").notNull(),
        status: signaturesStatus("status").notNull().default("pending"),
        signedAt: timestamp("signed_at"),
        cryptoKey: uuid("crypto_key")
            .notNull()
            .references(() => cryptoKeys.id),
        signaturePayload: text("signature_payload").notNull(),
        signatureAlgorithm: text("signature_algorithm").notNull(),
    },
    (table) => [
        index("signatures_document_id_idx").on(table.documentId),
        index("signatures_crypto_key_idx").on(table.cryptoKey),
        index("signatures_status_idx").on(table.status),
    ],
).enableRLS();

export const documentAssignments = pgTable(
    "document_assignments",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        documentId: uuid("document_id")
            .notNull()
            .references(() => documents.id)
            .unique(),
        packageId: uuid("package_id")
            .notNull()
            .references(() => packages.id),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [index("document_assignments_package_id_idx").on(table.packageId)],
).enableRLS();

export const packages = pgTable(
    "packages",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        name: text("name").notNull(),
        owner: text("owner")
            .notNull()
            .references(() => user.id),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [index("packages_owner_idx").on(table.owner)],
).enableRLS();

export const packageViewers = pgTable(
    "package_viewers",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        packageId: uuid("package_id")
            .notNull()
            .references(() => packages.id),
        userId: text("user_id")
            .notNull()
            .references(() => user.id),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        index("package_viewers_user_id_idx").on(table.userId),
        index("package_viewers_package_id_idx").on(table.packageId),
        unique("package_viewers_unique").on(table.packageId, table.userId),
    ],
).enableRLS();

// ── Views ─────────────────────────────────────────────────────────
// pending_documents: documents in packages where the user is a
// signatory but has NOT yet signed with any of their active keys.
// ───────────────────────────────────────────────────────────────────
export const pendingDocumentsView = pgView("pending_documents")
    .with({
        securityInvoker: true,
    })
    .as((qb) =>
        qb
            .select({
                id: documents.id,
                title: documents.title,
                status: documents.status,
                updatedAt: documents.updatedAt,
                signatoryUserId: packageRecipients.userId,
            })
            .from(documents)
            .innerJoin(documentAssignments, eq(documents.id, documentAssignments.documentId))
            .innerJoin(
                packageRecipients,
                eq(documentAssignments.packageId, packageRecipients.packageId),
            ).where(sql`${packageRecipients.role} = 'signer' AND NOT EXISTS (
            SELECT 1 FROM ${signatures}
            INNER JOIN ${cryptoKeys}
                ON ${signatures.cryptoKey} = ${cryptoKeys.id}
                AND ${cryptoKeys.userId} = ${packageRecipients.userId}
                AND ${cryptoKeys.revokedAt} IS NULL
            WHERE ${signatures.documentId} = ${documents.id}
        )`),
    );

// completed_documents: documents the user has signed (signed or
// anchored status), deduplicated across multiple keys.
// ───────────────────────────────────────────────────────────────────
export const completedDocumentsView = pgView("completed_documents")
    .with({
        securityInvoker: true,
    })
    .as((qb) =>
        qb
            .selectDistinct({
                id: documents.id,
                title: documents.title,
                status: documents.status,
                updatedAt: documents.updatedAt,
                signatoryUserId: cryptoKeys.userId,
            })
            .from(documents)
            .innerJoin(signatures, eq(documents.id, signatures.documentId))
            .innerJoin(cryptoKeys, eq(signatures.cryptoKey, cryptoKeys.id))
            .where(inArray(signatures.status, ["signed", "anchored"])),
    );

export * from "./auth.schema";
