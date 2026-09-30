import { createInsertSchema } from "drizzle-zod";
import {
  jsonb,
  pgTable,
  real,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export type FertilizerStep = {
  growthStage: string;
  fertilizerName: string;
  dosagePerAcre: string;
  applicationMethod: string;
  timingNotes: string;
};

export type IrrigationStep = {
  stage: string;
  waterFrequencyDays: string;
  criticalWarnings: string;
};

export const advisoriesTable = pgTable("crop_advisories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  cropName: varchar("crop_name", { length: 80 }).notNull(),
  growthStage: varchar("growth_stage", { length: 40 }).notNull(),
  soilType: varchar("soil_type", { length: 40 }).notNull(),
  fieldAreaAcres: real("field_area_acres").notNull(),
  nitrogenLevel: real("nitrogen_level"),
  phosphorusLevel: real("phosphorus_level"),
  potassiumLevel: real("potassium_level"),
  phLevel: real("ph_level"),
  irrigationMethod: varchar("irrigation_method", { length: 40 }).notNull(),
  fertilizerSchedule: jsonb("fertilizer_schedule").$type<FertilizerStep[]>().notNull().default([]),
  irrigationSchedule: jsonb("irrigation_schedule").$type<IrrigationStep[]>().notNull().default([]),
  pestWarningLevel: varchar("pest_warning_level", { length: 16 }).notNull(),
  recommendedActions: jsonb("recommended_actions").$type<string[]>().notNull().default([]),
  yieldOptimizations: jsonb("yield_optimizations").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdvisorySchema = createInsertSchema(advisoriesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAdvisory = z.infer<typeof insertAdvisorySchema>;
export type Advisory = typeof advisoriesTable.$inferSelect;