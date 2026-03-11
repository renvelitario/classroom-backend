import express from "express";
import { user } from "../db/schema/index.js";
import { ilike, or, and, eq } from "drizzle-orm/sql/expressions/conditions";
import { sql } from "drizzle-orm/sql/sql";
import { db } from "../db/index.js";
import { desc, getTableColumns } from "drizzle-orm";

const router = express.Router();

// Get all users with optional search, filtering, and pagination
router.get("/", async (req, res) => {
  try {
    const { search, role, page = 1, limit = 10 } = req.query;
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
    const roleTerm = firstString(role);

    const offset = (currentPage - 1) * limitPerPage;

    const filterConditions = [];

    // If search query exists, filter by user name or email
    if (searchTerm) {
      filterConditions.push(
        or(
          ilike(user.name, `%${searchTerm}%`),
          ilike(user.email, `%${searchTerm}%`),
        ),
      );
    }

    // If role filter exists, match exact role
    if (roleTerm) {
      filterConditions.push(eq(user.role, roleTerm as "student" | "teacher" | "admin"));
    }

    // Combine all filters using AND if any exist
    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .where(whereClause);

    const totalCount = countResult[0]?.count || 0;

    const userList = await db
      .select({
        ...getTableColumns(user),
      })
      .from(user)
      .where(whereClause)
      .orderBy(desc(user.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    res.status(200).json({
      data: userList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

export default router;
