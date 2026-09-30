import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  res.locals.userId = userId;
  next();
}

export function authenticatedUserId(res: Response): string {
  const userId: unknown = res.locals.userId;
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("Authenticated request is missing a user id.");
  }
  return userId;
}