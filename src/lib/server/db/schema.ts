import { integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

// cryptograph keys
export const cryptoKeys = pgTable('user_keys', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => user.id),
	pubkey: text('pubkey').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	revokedAt: timestamp('revoked_at')
});

// public: shows hash, actual PDF, and signatures with signer info
// restricted: shows hash and signatures as "validated" unless logged in
export const viewAccessEnum = pgEnum('view_access', ['public', 'restricted']);

// draft = being edited, not ready for signing
// finalized = ready for signing, invitations sent
// executed = fully signed and completed, no more changes allowed. deletion prohibited.
export const documentStatusEnum = pgEnum('document_status', ['draft', 'finalized', 'executed']);

export const documents = pgTable('documents', {
	id: uuid('id').primaryKey().defaultRandom(),
	title: text('title').notNull(),
	owner: uuid('owner')
		.notNull()
		.references(() => user.id),
	detailedViewAccess: viewAccessEnum('detailed_view_access').notNull().default('restricted'),
	hash: text('hash').notNull(),
	status: documentStatusEnum('status').notNull().default('draft')
});

// for actual signing
// pending = signature request sent, waiting for blockchain
// signed = signature confirmed on blockchain
// anchored = signature is anchored on public blockchain
// rejected = signature request rejected by signer
export const signaturesStatus = pgEnum('signature_status', [
	'pending',
	'signed',
	'anchored',
	'rejected'
]);

export const documentSignatories = pgTable('document_signatories', {
	id: uuid('id').primaryKey().defaultRandom(),
	documentId: uuid('document_id')
		.notNull()
		.references(() => documents.id),
	userId: uuid('user_id')
		.notNull()
		.references(() => user.id),
	signerId: integer('signer_id')
});

export const signatures = pgTable('signatures', {
	txId: text('tx_id').primaryKey(),
	documentId: uuid('document_id')
		.notNull()
		.references(() => documents.id),
	documentHash: text('document_hash').notNull(),
	status: signaturesStatus('status').notNull().default('pending'),
	signedAt: timestamp('signed_at'),
	cryptoKey: uuid('crypto_key')
		.notNull()
		.references(() => cryptoKeys.id),
	signaturePayload: text('signature_payload').notNull(),
	signatureAlgorithm: text('signature_algorithm').notNull()
});

export const documentViewers = pgTable('document_viewers', {
	id: uuid('id').primaryKey().defaultRandom(),
	documentId: uuid('document_id')
		.notNull()
		.references(() => documents.id),
	userId: uuid('user_id')
		.notNull()
		.references(() => user.id)
});

export * from './auth.schema';
