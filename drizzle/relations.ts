import { relations } from "drizzle-orm/relations";
import { documents, documentViewers, user, userKeys, signatures, documentSignatories, account, passkey, session } from "./schema";

export const documentViewersRelations = relations(documentViewers, ({one}) => ({
	document: one(documents, {
		fields: [documentViewers.documentId],
		references: [documents.id]
	}),
	user: one(user, {
		fields: [documentViewers.userId],
		references: [user.id]
	}),
}));

export const documentsRelations = relations(documents, ({one, many}) => ({
	documentViewers: many(documentViewers),
	signatures: many(signatures),
	documentSignatories: many(documentSignatories),
	user: one(user, {
		fields: [documents.owner],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	documentViewers: many(documentViewers),
	documentSignatories: many(documentSignatories),
	documents: many(documents),
	userKeys: many(userKeys),
	accounts: many(account),
	passkeys: many(passkey),
	sessions: many(session),
}));

export const signaturesRelations = relations(signatures, ({one}) => ({
	userKey: one(userKeys, {
		fields: [signatures.cryptoKey],
		references: [userKeys.id]
	}),
	document: one(documents, {
		fields: [signatures.documentId],
		references: [documents.id]
	}),
}));

export const userKeysRelations = relations(userKeys, ({one, many}) => ({
	signatures: many(signatures),
	user: one(user, {
		fields: [userKeys.userId],
		references: [user.id]
	}),
}));

export const documentSignatoriesRelations = relations(documentSignatories, ({one}) => ({
	document: one(documents, {
		fields: [documentSignatories.documentId],
		references: [documents.id]
	}),
	user: one(user, {
		fields: [documentSignatories.userId],
		references: [user.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const passkeyRelations = relations(passkey, ({one}) => ({
	user: one(user, {
		fields: [passkey.userId],
		references: [user.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));