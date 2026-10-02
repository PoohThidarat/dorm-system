import { Request } from "express";

// หน้าที่ของไฟล์: อ่าน query string มาตรฐาน (page, pageSize, search, sortBy, sortOrder)
// ให้ทุก List Endpoint ใช้ร่วมกัน ตาม spec ข้อ 21 (Search & Filter & Sort & Pagination)

export interface ListQuery {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  search?: string;
  sortBy?: string;
  sortOrder: "asc" | "desc";
}

const MAX_PAGE_SIZE = 100;

export function parseListQuery(req: Request, defaultSortBy = "id"): ListQuery {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || 20));
  const search = typeof req.query.search === "string" && req.query.search.trim() !== ""
    ? req.query.search.trim()
    : undefined;
  const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : defaultSortBy;
  const sortOrder = req.query.sortOrder === "desc" ? "desc" : "asc";

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    search,
    sortBy,
    sortOrder,
  };
}

export function paginatedResult<T>(items: T[], total: number, query: ListQuery) {
  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}
