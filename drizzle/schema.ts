import { pgTable, uuid, text, foreignKey, timestamp, integer, unique, boolean, index, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const documentStatus = pgEnum("document_status", ['draft', 'finalized', 'executed'])
export const signatureStatus = pgEnum("signature_status", ['pending', 'signed', 'anchored', 'rejected'])
export const viewAccess = pgEnum("view_access", ['public', 'restricted'])


export const packages = pgTable("packages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	owner: text().notNull(),
});

export const documentViewers = pgTable("document_viewers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid("document_id").notNull(),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_viewers_document_id_documents_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "document_viewers_user_id_user_id_fk"
		}),
]);

export const signatures = pgTable("signatures", {
	txId: text("tx_id").primaryKey().notNull(),
	documentId: uuid("document_id").notNull(),
	documentHash: text("document_hash").notNull(),
	status: signatureStatus().default('pending').notNull(),
	signedAt: timestamp("signed_at", { mode: 'string' }),
	cryptoKey: uuid("crypto_key").notNull(),
	signaturePayload: text("signature_payload").notNull(),
	signatureAlgorithm: text("signature_algorithm").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.cryptoKey],
			foreignColumns: [userKeys.id],
			name: "signatures_crypto_key_user_keys_id_fk"
		}),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "signatures_document_id_documents_id_fk"
		}),
]);

export const documentSignatories = pgTable("document_signatories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid("document_id").notNull(),
	userId: text("user_id").notNull(),
	signerId: integer("signer_id"),
}, (table) => [
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_signatories_document_id_documents_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "document_signatories_user_id_user_id_fk"
		}),
]);

export const documents = pgTable("documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	owner: text().notNull(),
	detailedViewAccess: viewAccess("detailed_view_access").default('restricted').notNull(),
	hash: text().notNull(),
	status: documentStatus().default('draft').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.owner],
			foreignColumns: [user.id],
			name: "documents_owner_user_id_fk"
		}),
]);

export const userKeys = pgTable("user_keys", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	pubkey: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	revokedAt: timestamp("revoked_at", { mode: 'string' }),
	pkey: text().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "user_keys_user_id_user_id_fk"
		}),
]);

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("user_email_unique").on(table.email),
]);

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("account_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const passkey = pgTable("passkey", {
	id: text().primaryKey().notNull(),
	name: text(),
	publicKey: text("public_key").notNull(),
	userId: text("user_id").notNull(),
	credentialId: text("credential_id").notNull(),
	counter: integer().notNull(),
	deviceType: text("device_type").notNull(),
	backedUp: boolean("backed_up").notNull(),
	transports: text(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	aaguid: text(),
}, (table) => [
	index("passkey_credentialID_idx").using("btree", table.credentialId.asc().nullsLast().op("text_ops")),
	index("passkey_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "passkey_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
}, (table) => [
	index("session_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("session_token_unique").on(table.token),
]);

export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("verification_identifier_idx").using("btree", table.identifier.asc().nullsLast().op("text_ops")),
]);
