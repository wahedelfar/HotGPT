import { and, desc, eq, gt, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, paymentRequests, users } from "../drizzle/schema.ts";
import { ENV } from './_core/env.ts';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.


function affectedRowsOf(result: unknown): number {
  const first = Array.isArray(result) ? result[0] : result;
  return typeof first === "object" && first !== null && "affectedRows" in first
    ? Number((first as { affectedRows: unknown }).affectedRows)
    : 0;
}

export async function getWallet(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select({
    freeAnswersUsed: users.freeAnswersUsed,
    tokenBalance: users.tokenBalance,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!rows[0]) throw new Error("User not found");
  return { ...rows[0], freeAnswersRemaining: Math.max(0, 2 - rows[0].freeAnswersUsed) };
}

/** Atomically consume one answer credit. Free answers are used before paid credits. */
export async function consumeAnswerCredit(userId: number): Promise<"free" | "paid" | null> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const freeResult = await db.update(users)
    .set({ freeAnswersUsed: sql`${users.freeAnswersUsed} + 1` })
    .where(and(eq(users.id, userId), lt(users.freeAnswersUsed, 2)));
  if (affectedRowsOf(freeResult) === 1) return "free";

  const paidResult = await db.update(users)
    .set({ tokenBalance: sql`${users.tokenBalance} - 1` })
    .where(and(eq(users.id, userId), gt(users.tokenBalance, 0)));
  if (affectedRowsOf(paidResult) === 1) return "paid";
  return null;
}

export async function refundAnswerCredit(userId: number, kind: "free" | "paid") {
  const db = await getDb();
  if (!db) return;
  if (kind === "free") {
    await db.update(users)
      .set({ freeAnswersUsed: sql`GREATEST(0, ${users.freeAnswersUsed} - 1)` })
      .where(eq(users.id, userId));
  } else {
    await db.update(users)
      .set({ tokenBalance: sql`${users.tokenBalance} + 1` })
      .where(eq(users.id, userId));
  }
}

export async function listWalletUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    tokenBalance: users.tokenBalance,
    freeAnswersUsed: users.freeAnswersUsed,
    createdAt: users.createdAt,
  }).from(users).orderBy(desc(users.createdAt)).limit(500);
}

export async function setTokenBalanceByEmail(email: string, balance: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.select({ id: users.id, email: users.email })
    .from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (!existing[0]) return null;
  await db.update(users).set({ tokenBalance: balance }).where(eq(users.id, existing[0].id));
  const updated = await db.select({
    id: users.id, name: users.name, email: users.email,
    tokenBalance: users.tokenBalance, freeAnswersUsed: users.freeAnswersUsed,
  }).from(users).where(eq(users.id, existing[0].id)).limit(1);
  return updated[0] ?? null;
}

export async function submitPaymentRequest(input: {
  userId: number;
  email: string;
  paymentMethod: "vodafone_cash" | "paypal";
  packageTokens: number;
  amountEgp: number;
  transferReference?: string;
  screenshotData: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(paymentRequests).values({
    ...input,
    transferReference: input.transferReference?.trim() || null,
    status: "pending",
  });
  const header = Array.isArray(result) ? result[0] : result;
  return { id: Number((header as { insertId?: number }).insertId ?? 0), status: "pending" as const };
}

export async function listPaymentRequests() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select({
    id: paymentRequests.id,
    userId: paymentRequests.userId,
    email: paymentRequests.email,
    paymentMethod: paymentRequests.paymentMethod,
    packageTokens: paymentRequests.packageTokens,
    amountEgp: paymentRequests.amountEgp,
    transferReference: paymentRequests.transferReference,
    status: paymentRequests.status,
    createdAt: paymentRequests.createdAt,
    reviewedAt: paymentRequests.reviewedAt,
    reviewedBy: paymentRequests.reviewedBy,
  }).from(paymentRequests).orderBy(desc(paymentRequests.createdAt)).limit(200);
}

export async function getPaymentProofById(paymentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select({
    id: paymentRequests.id,
    email: paymentRequests.email,
    screenshotData: paymentRequests.screenshotData,
  }).from(paymentRequests).where(eq(paymentRequests.id, paymentId)).limit(1);
  return rows[0] ?? null;
}

export async function reviewPaymentRequest(
  paymentId: number,
  approve: boolean,
  reviewedBy: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const rows = await tx.select().from(paymentRequests)
      .where(eq(paymentRequests.id, paymentId)).limit(1);
    const payment = rows[0];
    if (!payment) throw new Error("Payment request not found");
    if (payment.status !== "pending") throw new Error("Payment request already reviewed");

    const updateResult = await tx.update(paymentRequests).set({
      status: approve ? "approved" : "rejected",
      reviewedAt: new Date(),
      reviewedBy,
    }).where(and(eq(paymentRequests.id, paymentId), eq(paymentRequests.status, "pending")));
    if (affectedRowsOf(updateResult) !== 1) throw new Error("Payment request already reviewed");

    if (approve) {
      await tx.update(users)
        .set({ tokenBalance: sql`${users.tokenBalance} + ${payment.packageTokens}` })
        .where(eq(users.id, payment.userId));
    }
    return { ...payment, status: approve ? "approved" as const : "rejected" as const };
  });
}
