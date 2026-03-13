import express from "express";
import { db } from "../db/index.js";
import { classes, subjects, user } from "../db/schema/index.js";
import { ilike, or, and, eq } from "drizzle-orm/sql/expressions/conditions";
import { sql } from "drizzle-orm/sql/sql";
import { desc, getTableColumns } from "drizzle-orm";

const router = express.Router();

// Get all classes with optional search, filtering, and pagination
router.get("/", async (req, res) => {
  try {
    const { search, subject, teacher, page = 1, limit = 10 } = req.query;
    const firstString = (v: unknown): string | undefined =>
      typeof v === "string"
        ? v
        : Array.isArray(v) && typeof v[0] === "string"
          ? v[0]
          : undefined;

    const toPositiveInt = (
      v: unknown,
      fallback: number,
      max?: number,
    ): number => {
      const n = Number(firstString(v) ?? v);
      if (!Number.isFinite(n) || n < 1) return fallback;
      const int = Math.floor(n);
      return max ? Math.min(int, max) : int;
    };

    const currentPage = toPositiveInt(page, 1);
    const limitPerPage = toPositiveInt(limit, 10, 100);
    const searchTerm = firstString(search);
    const subjectTerm = firstString(subject);
    const teacherTerm = firstString(teacher);

    const offset = (currentPage - 1) * limitPerPage;

    const filterConditions = [];

    // If search query exists, filter by class name or invite code
    if (searchTerm) {
      filterConditions.push(
        or(
          ilike(classes.name, `%${searchTerm}%`),
          ilike(classes.inviteCode, `%${searchTerm}%`),
        ),
      );
    }

    // If subject filter exists, match subject name
    if (subjectTerm) {
      filterConditions.push(ilike(subjects.name, `%${subjectTerm}%`));
    }

    // If teacher filter exists, match teacher name
    if (teacherTerm) {
      filterConditions.push(ilike(user.name, `%${teacherTerm}%`));
    }

    // Combine all filters using AND if any exist
    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(classes)
      .leftJoin(subjects, eq(classes.subjectId, subjects.id))
      .leftJoin(user, eq(classes.teacherId, user.id))
      .where(whereClause);

    const totalCount = countResult[0]?.count || 0;

    const classList = await db
      .select({
        ...getTableColumns(classes),
        subject: { ...getTableColumns(subjects) },
        teacher: { ...getTableColumns(user) },
      })
      .from(classes)
      .leftJoin(subjects, eq(classes.subjectId, subjects.id))
      .leftJoin(user, eq(classes.teacherId, user.id))
      .where(whereClause)
      .orderBy(desc(classes.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    res.status(200).json({
      data: classList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (error) {
    console.error("Error fetching classes:", error);
    res.status(500).json({ error: "Failed to fetch classes" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      name,
      teacherId,
      subjectId,
      capacity,
      description,
      status,
      bannerUrl,
      bannerCldPubId,
    } = req.body;

    const [createdClass] = await db
      .insert(classes)
      .values({
        ...req.body,
        inviteCode: Math.random().toString(36).substring(2, 9),
        schedules: [],
      })
      .returning();

    if (!createdClass) throw Error;

    res.status(201).json({ message: "Class created successfully" });
  } catch (error) {
    console.error("Error creating class:", error);
    res.status(500).json({ error: "Failed to create class" });
  }
});

export default router;
