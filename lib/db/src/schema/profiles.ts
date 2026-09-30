import { createInsertSchema } from "drizzle-zod";
import { timestamp, varchar, real, text, jsonb, pgTable } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  userId: varchar("user_id", { length: 255 }).primaryKey(),
  fullName: varchar("full_name", { length: 120 }).notNull().default("Farm manager"),
  phoneNumber: varchar("phone_number", { length: 40 }),
  preferredLanguage: varchar("preferred_language", { length: 8 }).notNull().default("en"),
  locationName: varchar("location_name", { length: 160 }),
  latitude: real("latitude"),
  longitude: real("longitude"),
  farmSizeAcres: real("farm_size_acres"),
  defaultSoilType: varchar("default_soil_type", { length: 40 }),
  primaryCrops: jsonb("primary_crops").$type<string[]>().notNull().default([]),
  role: varchar("role", { length: 24 }).notNull().default("farmer"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertProfileSchema = createInsertSchema(profilesTable);
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;