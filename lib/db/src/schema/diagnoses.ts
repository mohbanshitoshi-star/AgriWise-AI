import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  jsonb,
  pgTable,
  real,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const diagnosesTable = pgTable("crop_diagnoses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  cropName: varchar("crop_name", { length: 80 }).notNull(),
  diseaseDetected: varchar("disease_detected", { length: 160 }).notNull(),
  isHealthy: boolean("is_healthy").notNull().default(false),
  confidenceScore: real("confidence_score").notNull(),
  severityLevel: varchar("severity_level", { length: 16 }).notNull(),
  symptoms: jsonb("symptoms").$type<string[]>().notNull().default([]),
  treatmentChemical: jsonb("treatment_chemical").$type<string[]>().notNull().default([]),
  treatmentOrganic: jsonb("treatment_organic").$type<string[]>().notNull().default([]),
  preventionSteps: jsonb("prevention_steps").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDiagnosisSchema = createInsertSchema(diagnosesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDiagnosis = z.infer<typeof insertDiagnosisSchema>;
export type Diagnosis = typeof diagnosesTable.$inferSelect;