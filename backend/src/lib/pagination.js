const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function positiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// One page of a Prisma query, plus what a pager needs to draw itself. `query` is req.query.
// A page past the end comes back as the last page: removing the last row on a page
// shouldn't leave someone looking at an empty list.
async function findPage(model, args, query) {
  const total = await model.count({ where: args.where });
  const pageSize = Math.min(positiveInt(query.pageSize) ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(positiveInt(query.page) ?? 1, totalPages);
  const items = await model.findMany({ ...args, skip: (page - 1) * pageSize, take: pageSize });
  return { items, pagination: { page, pageSize, total, totalPages } };
}

module.exports = { findPage };
