/**
 * Email Categories Routes - Internal API
 *
 * User-scoped categories for monitored-email senders (TEEPER-105).
 * Seeded lazily with 10 defaults on first GET. Slugs are immutable after
 * create — renames update `name` only so /category/:slug URLs remain stable.
 * Historical snapshot columns on digest_emails are similarly frozen and do
 * NOT cascade on rename or delete.
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error';
import { storage } from '../services/storage';
import { slugify } from '../services/category-defaults';

const router = Router();

const apiResponse = (data: any, message?: string) => ({
  success: true,
  data,
  ...(message && { message }),
});

const apiError = (message: string, code?: string) => ({
  success: false,
  error: message,
  ...(code && { code }),
});

// GET /api/storage/email-categories/:userId — lazy-seeds 10 defaults on first read
router.get('/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const categories = await storage.getEmailCategories(userId);
  return res.json(apiResponse(categories));
}));

// POST /api/storage/email-categories — create a new user-scoped category
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { userId, name, color, sortOrder } = req.body;

  if (!userId || !name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json(apiError('userId and non-empty name are required', 'MISSING_FIELDS'));
  }

  const trimmedName = name.trim();
  const slug = slugify(trimmedName);
  if (!slug) {
    return res.status(400).json(apiError('Name must contain URL-safe characters', 'INVALID_NAME'));
  }

  try {
    const created = await storage.createEmailCategory({
      userId,
      name: trimmedName,
      slug,
      color: color ?? null,
      isDefault: false,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 1000,
    });
    return res.status(201).json(apiResponse(created, 'Category created'));
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json(apiError('Category name or slug already exists for this user', 'DUPLICATE'));
    }
    throw err;
  }
}));

// PATCH /api/storage/email-categories/:id — rename / recolor / reorder. Slug is immutable.
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json(apiError('Invalid ID', 'INVALID_ID'));
  }

  const { userId, name, color, sortOrder } = req.body;
  if (!userId) {
    return res.status(400).json(apiError('userId is required', 'MISSING_FIELDS'));
  }

  try {
    const updated = await storage.updateEmailCategory(userId, id, {
      name: typeof name === 'string' ? name.trim() : undefined,
      color: color ?? undefined,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : undefined,
    });
    if (!updated) {
      return res.status(404).json(apiError('Category not found', 'NOT_FOUND'));
    }
    return res.json(apiResponse(updated, 'Category updated'));
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json(apiError('Category name already exists for this user', 'DUPLICATE'));
    }
    throw err;
  }
}));

// DELETE /api/storage/email-categories/:id — FK SET NULL handles dependents
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json(apiError('Invalid ID', 'INVALID_ID'));
  }
  const userId = (req.body?.userId ?? req.query?.userId) as string | undefined;
  if (!userId) {
    return res.status(400).json(apiError('userId is required', 'MISSING_FIELDS'));
  }

  const ok = await storage.deleteEmailCategory(userId, id);
  if (!ok) {
    return res.status(404).json(apiError('Category not found', 'NOT_FOUND'));
  }
  return res.json(apiResponse(null, 'Category deleted'));
}));

export { router as emailCategoriesRoutes };
