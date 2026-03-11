import { relations } from "drizzle-orm/relations";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

// Departments table
export const departments = pgTable("departments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 255 }),
  ...timestamps,
});

// Subjects table (belongs to a department)
export const subjects = pgTable("subjects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  departmentId: integer("department_id")
    .notNull()
    .references(() => departments.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
  ...timestamps,
});

// Enum for class status
export const classStatusEnum = pgEnum("class_status", [
  "active",
  "inactive",
  "archived",
]);

// Classes table
export const classes = pgTable(
  "classes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // FK → subject
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),

    // FK → teacher (user table)
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),

    inviteCode: varchar("invite_code", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),

    // Banner image fields (Cloudinary)
    bannerCldPubId: text("banner_cld_pub_id"),
    bannerUrl: text("banner_url"),

    description: text("description"),
    capacity: integer("capacity").default(50).notNull(),

    status: classStatusEnum("status").default("active").notNull(),

    // Flexible schedule data (JSON)
    schedules: jsonb("schedules").$type<Record<string, unknown>[]>(),

    ...timestamps,
  },
  (table) => [
    // Indexes for faster queries
    index("classes_subjectId_idx").on(table.subjectId),
    index("classes_teacherId_idx").on(table.teacherId),
  ],
);

// Enrollment table (student ↔ class)
export const enrollments = pgTable(
  "enrollments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // FK → student
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // FK → class
    classId: integer("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),

    ...timestamps,
  },
  (table) => [
    // Prevent duplicate enrollments
    uniqueIndex("enrollments_studentId_classId_uq").on(
      table.studentId,
      table.classId,
    ),

    // Query optimization
    index("enrollments_studentId_idx").on(table.studentId),
    index("enrollments_classId_idx").on(table.classId),
  ],
);

// Department → Subjects relationship
export const departmentRelations = relations(departments, ({ many }) => ({
  subjects: many(subjects),
}));

// Subject → Department + Classes
export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  department: one(departments, {
    fields: [subjects.departmentId],
    references: [departments.id],
  }),
  classes: many(classes),
}));

// Class → Subject + Teacher + Enrollments
export const classesRelations = relations(classes, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [classes.subjectId],
    references: [subjects.id],
  }),
  teacher: one(user, {
    fields: [classes.teacherId],
    references: [user.id],
  }),
  enrollments: many(enrollments),
}));

// Enrollment → Student + Class
export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(user, {
    fields: [enrollments.studentId],
    references: [user.id],
  }),
  class: one(classes, {
    fields: [enrollments.classId],
    references: [classes.id],
  }),
}));

// Types for selecting records
export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;

export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
