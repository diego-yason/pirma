import { and, eq, inArray } from "drizzle-orm";
import { db } from "#lib/server/db/index.js";
import {
    packages,
    documents,
    documentAssignments,
    packageRecipients,
    signatures,
    guestTokens,
    emailEvents,
    user,
} from "#lib/server/db/schema.js";
import { EMAIL_REMIND_DAYS, ORIGIN } from "$app/env/private";
import { logger } from "#lib/server/logger.js";
import { createGuestToken } from "#lib/server/auth/guest-token.js";
import { sendEmail } from "./index.js";
import { renderReminder, reminderSubject } from "./templates/index.js";

/**
 * Sends due reminder emails to signers of finalized-but-not-executed packages.
 *
 * Schedule (days after the invite email): EMAIL_REMIND_DAYS (default "3,7").
 * A reminder is sent once per (package, recipient, day) — tracked by the
 * email_events idempotency key `reminder:{packageId}:{recipientId}:{day}`.
 *
 * Intended to be invoked from /api/cron/reminders (or any scheduler).
 */
export async function sendDueReminders(): Promise<number> {
    const days = (EMAIL_REMIND_DAYS || "3,7")
        .split(",")
        .map((d) => parseInt(d.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b);

    if (days.length === 0) {
        logger.warn("reminders", "No reminder days configured — skipping");
        return 0;
    }

    const now = new Date();

    // Packages that still have at least one finalized (not executed) document.
    const finalizedRows = await db
        .select({
            packageId: documentAssignments.packageId,
            documentId: documentAssignments.documentId,
        })
        .from(documentAssignments)
        .innerJoin(documents, eq(documentAssignments.documentId, documents.id))
        .where(eq(documents.status, "finalized"));

    const docsByPackage = new Map<string, string[]>();
    for (const row of finalizedRows) {
        const list = docsByPackage.get(row.packageId) ?? [];
        list.push(row.documentId);
        docsByPackage.set(row.packageId, list);
    }

    const packageIds = [...docsByPackage.keys()];
    if (packageIds.length === 0) return 0;

    const pkgRows = await db
        .select({
            id: packages.id,
            name: packages.name,
            owner: packages.owner,
            expirationDate: packages.expirationDate,
        })
        .from(packages)
        .where(inArray(packages.id, packageIds));

    const recipients = await db
        .select({
            id: packageRecipients.id,
            name: packageRecipients.name,
            email: packageRecipients.email,
            userId: packageRecipients.userId,
            packageId: packageRecipients.packageId,
        })
        .from(packageRecipients)
        .where(
            and(
                inArray(packageRecipients.packageId, packageIds),
                eq(packageRecipients.role, "signer"),
            ),
        );

    // Which documents each linked user has signed.
    const allDocIds = [...new Set(finalizedRows.map((d) => d.documentId))];
    const sigRows = allDocIds.length
        ? await db
              .select({
                  documentId: signatures.documentId,
                  signerUserId: signatures.signerUserId,
              })
              .from(signatures)
              .where(
                  and(
                      inArray(signatures.documentId, allDocIds),
                      inArray(signatures.status, ["signed", "anchored"]),
                  ),
              )
        : [];
    const signedByUser = new Map<string, Set<string>>();
    for (const s of sigRows) {
        const set = signedByUser.get(s.signerUserId) ?? new Set();
        set.add(s.documentId);
        signedByUser.set(s.signerUserId, set);
    }

    // Invite + reminder email_events, keyed by idempotency eventId.
    const recipientEmails = [...new Set(recipients.map((r) => r.email).filter((e): e is string => !!e))];
    const inviteEvents = recipientEmails.length
        ? await db
              .select({ eventId: emailEvents.eventId, sentAt: emailEvents.sentAt })
              .from(emailEvents)
              .where(
                  and(
                      eq(emailEvents.template, "signer-invite"),
                      inArray(emailEvents.to, recipientEmails),
                  ),
              )
        : [];
    const inviteSentAt = new Map<string, Date>();
    for (const ev of inviteEvents) {
        if (ev.sentAt) inviteSentAt.set(ev.eventId, ev.sentAt);
    }

    const reminderEvents = recipientEmails.length
        ? await db
              .select({ eventId: emailEvents.eventId })
              .from(emailEvents)
              .where(
                  and(
                      eq(emailEvents.template, "reminder"),
                      inArray(emailEvents.to, recipientEmails),
                  ),
              )
        : [];
    const sentReminder = new Set(reminderEvents.map((e) => e.eventId));

    // Owner names for the email "from" line.
    const ownerIds = [...new Set(pkgRows.map((p) => p.owner))];
    const ownerRows = await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.id, ownerIds));
    const ownerNames = new Map(ownerRows.map((u) => [u.id, u.name]));

    const dayMs = 24 * 60 * 60 * 1000;
    let sent = 0;

    for (const pkg of pkgRows) {
        const docIds = docsByPackage.get(pkg.id) ?? [];
        if (docIds.length === 0) continue;
        if (pkg.expirationDate && pkg.expirationDate.getTime() < now.getTime()) continue; // past deadline

        const pkgRecipients = recipients.filter((r) => r.packageId === pkg.id);

        for (const recipient of pkgRecipients) {
            if (!recipient.email) continue;

            // Skip signers who are already done.
            const signedCount = recipient.userId ? signedByUser.get(recipient.userId)?.size ?? 0 : 0;
            if (recipient.userId && signedCount >= docIds.length) continue;

            const inviteEventId = `signer-invite:${pkg.id}:${recipient.id}`;
            const inviteAt = inviteSentAt.get(inviteEventId);
            if (!inviteAt) continue; // never invited

            for (const day of days) {
                const eventId = `reminder:${pkg.id}:${recipient.id}:${day}`;
                if (sentReminder.has(eventId)) continue;
                if (now.getTime() - inviteAt.getTime() < day * dayMs) continue;

                const signUrl = await signUrlFor(recipient.id, pkg.id, recipient.userId);

                await sendEmail({
                    eventId,
                    template: "reminder",
                    to: recipient.email,
                    subject: reminderSubject(pkg.name),
                    html: renderReminder({
                        recipientName: recipient.name,
                        senderName: ownerNames.get(pkg.owner) ?? null,
                        packageName: pkg.name,
                        signUrl,
                        deadline: pkg.expirationDate?.toISOString() ?? null,
                    }),
                });
                sent += 1;
            }
        }
    }

    logger.info("reminders", "Reminder pass complete", { sent });
    return sent;
}

/** Builds a signing URL for a recipient — reuses/creates a guest token for unlinked recipients. */
async function signUrlFor(
    recipientId: string,
    packageId: string,
    userId: string | null,
): Promise<string> {
    const base = `${ORIGIN}/doc/${packageId}/sign`;
    if (userId) return base; // registered/linked user signs in normally

    const [existing] = await db
        .select({ token: guestTokens.token })
        .from(guestTokens)
        .where(
            and(
                eq(guestTokens.recipientId, recipientId),
                eq(guestTokens.packageId, packageId),
            ),
        )
        .limit(1);
    if (existing) return `${base}?token=${existing.token}`;

    const token = createGuestToken(recipientId, packageId);
    await db.insert(guestTokens).values({
        recipientId,
        packageId,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    return `${base}?token=${token}`;
}
