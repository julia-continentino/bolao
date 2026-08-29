import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const INVITE_EXPIRY_DAYS = 7;

export function generateInviteTokenValue(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createInviteForUser(userId: string) {
  // Invalidate any previous unused invite tokens for this user.
  await prisma.inviteToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = generateInviteTokenValue();
  const expiresAt = new Date(
    Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  const invite = await prisma.inviteToken.create({
    data: { token, userId, expiresAt },
  });

  return invite;
}

export type InviteValidation =
  | { valid: true; userId: string; name: string; email: string }
  | { valid: false; reason: "not_found" | "expired" | "used" };

export async function validateInviteToken(
  token: string
): Promise<InviteValidation> {
  const invite = await prisma.inviteToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!invite) return { valid: false, reason: "not_found" };
  if (invite.usedAt) return { valid: false, reason: "used" };
  if (invite.expiresAt < new Date()) return { valid: false, reason: "expired" };

  return {
    valid: true,
    userId: invite.user.id,
    name: invite.user.name,
    email: invite.user.email,
  };
}

export async function consumeInviteToken(token: string) {
  await prisma.inviteToken.update({
    where: { token },
    data: { usedAt: new Date() },
  });
}
