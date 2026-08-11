import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/db';
import { AuthRequest, getUserId } from '../middleware/auth';

// ── helpers ──────────────────────────────────────────────
const validationError = (res: Response, errors: any) =>
  res.status(422).json({ success: false, errors: errors.array().map((e: any) => ({ field: e.path, message: e.msg })) });

const parsePage = (p: unknown, limit: unknown) => {
  const pageValue =
    typeof p === 'string'
      ? p
      : Array.isArray(p) && typeof p[0] === 'string'
        ? p[0]
        : '';

  const limitValue =
    typeof limit === 'string'
      ? limit
      : Array.isArray(limit) && typeof limit[0] === 'string'
        ? limit[0]
        : '';

  const page = Math.max(1, parseInt(pageValue, 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(limitValue, 10) || 20));

  return { page, size, offset: (page - 1) * size };
};

const getQueryString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return '';
};

const getParamString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return '';
};

// ── validation rules ─────────────────────────────────────
export const productValidation = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('sku').trim().notEmpty().withMessage('SKU is required')
    .matches(/^[A-Za-z0-9\-_]+$/).withMessage('SKU must be alphanumeric (hyphens/underscores allowed)'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('unit_price').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
  body('current_stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('min_stock_alert').isInt({ min: 0 }).withMessage('Min stock alert must be a non-negative integer'),
];

export const stockMovementValidation = [
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('movement_type').isIn(['IN', 'OUT']).withMessage('Movement type must be IN or OUT'),
  body('reason').optional().trim(),
];

// ── GET /products ─────────────────────────────────────────
export const getProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, size, offset } = parsePage(req.query.page, req.query.limit);
    const search   = getQueryString(req.query.search).trim();
    const category = getQueryString(req.query.category).trim();
    const lowStock = getQueryString(req.query.low_stock) === 'true';

    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      conditions.push('(name LIKE ? OR sku LIKE ? OR category LIKE ? OR location LIKE ?)');
      params.push(...Array(4).fill(`%${search}%`));
    }
    if (category) { conditions.push('category = ?'); params.push(category); }
    if (lowStock)  { conditions.push('current_stock <= min_stock_alert'); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [[{ total }]]: any = await pool.query(`SELECT COUNT(*) as total FROM products ${where}`, params);
    const [rows]: any = await pool.query(
      `SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, size, offset]
    );

    res.status(200).json({
      success: true,
      data: rows,
      pagination: { total, page, limit: size, pages: Math.ceil(total / size) }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ── GET /products/movements ───────────────────────────────
export const getStockMovements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, size, offset } = parsePage(req.query.page, req.query.limit);
    const productId = getQueryString(req.query.product_id);
    const type      = getQueryString(req.query.type);

    const conditions: string[] = [];
    const params: any[] = [];
    if (productId) { conditions.push('sm.product_id = ?'); params.push(productId); }
    if (type && ['IN','OUT'].includes(type)) { conditions.push('sm.movement_type = ?'); params.push(type); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [[{ total }]]: any = await pool.query(
      `SELECT COUNT(*) as total FROM stock_movements sm ${where}`, params
    );
    const [rows]: any = await pool.query(
      `SELECT sm.*, p.name as product_name, p.sku FROM stock_movements sm
       JOIN products p ON sm.product_id = p.id
       ${where} ORDER BY sm.created_at DESC LIMIT ? OFFSET ?`,
      [...params, size, offset]
    );

    res.status(200).json({
      success: true,
      data: rows,
      pagination: { total, page, limit: size, pages: Math.ceil(total / size) }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ── GET /products/:id ─────────────────────────────────────
export const getProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(getParamString(req.params.id));
  if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid product ID' }); return; }
  try {
    const [rows]: any = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    if (rows.length === 0) { res.status(404).json({ success: false, message: 'Product not found' }); return; }
    const [movements]: any = await pool.query(
      `SELECT sm.*, p.name as product_name FROM stock_movements sm
       JOIN products p ON sm.product_id = p.id
       WHERE sm.product_id = ? ORDER BY sm.created_at DESC LIMIT 50`, [id]
    );
    res.status(200).json({ success: true, data: { ...rows[0], movements } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ── POST /products ────────────────────────────────────────
export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { validationError(res, errors); return; }

  const { name, sku, category, unit_price, current_stock, min_stock_alert, location } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing]: any = await conn.query('SELECT id FROM products WHERE sku = ?', [sku]);
    if (existing.length > 0) {
      res.status(409).json({ success: false, message: `SKU "${sku}" already exists` });
      await conn.rollback(); return;
    }

    const [result]: any = await conn.execute(
      `INSERT INTO products (name, sku, category, unit_price, current_stock, min_stock_alert, location) VALUES (?,?,?,?,?,?,?)`,
      [name, sku.toUpperCase(), category, unit_price, current_stock, min_stock_alert, location || null]
    );
    const productId = result.insertId;

    if (Number(current_stock) > 0) {
      const userId = getUserId(req);
      const [user]: any = await conn.query('SELECT name FROM users WHERE id = ?', [userId]);
      await conn.execute(
        `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) VALUES (?,?,?,?,?)`,
        [productId, current_stock, 'IN', 'Initial stock', user[0]?.name || 'System']
      );
    }

    await conn.commit();
    res.status(201).json({ success: true, message: 'Product created successfully', data: { id: productId } });
  } catch (err: any) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  } finally { conn.release(); }
};

// ── PUT /products/:id ─────────────────────────────────────
export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(getParamString(req.params.id));
  if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid product ID' }); return; }

  const errors = validationResult(req);
  if (!errors.isEmpty()) { validationError(res, errors); return; }

  const { name, sku, category, unit_price, min_stock_alert, location } = req.body;
  try {
    const [result]: any = await pool.execute(
      `UPDATE products SET name=?, sku=?, category=?, unit_price=?, min_stock_alert=?, location=? WHERE id=?`,
      [name, sku.toUpperCase(), category, unit_price, min_stock_alert, location || null, id]
    );
    if (result.affectedRows === 0) { res.status(404).json({ success: false, message: 'Product not found' }); return; }
    res.status(200).json({ success: true, message: 'Product updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ── DELETE /products/:id ──────────────────────────────────
export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(getParamString(req.params.id));
  if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid product ID' }); return; }
  try {
    const [result]: any = await pool.execute('DELETE FROM products WHERE id = ?', [id]);
    if (result.affectedRows === 0) { res.status(404).json({ success: false, message: 'Product not found' }); return; }
    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ── POST /products/:id/stock ──────────────────────────────
export const addStockMovement = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(getParamString(req.params.id));
  if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid product ID' }); return; }

  const errors = validationResult(req);
  if (!errors.isEmpty()) { validationError(res, errors); return; }

  const { quantity, movement_type, reason } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows]: any = await conn.query('SELECT id, name, current_stock FROM products WHERE id = ?', [id]);
    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Product not found' });
      await conn.rollback(); return;
    }

    const { current_stock, name } = rows[0];
    if (movement_type === 'OUT' && current_stock < Number(quantity)) {
      res.status(400).json({
        success: false,
        message: `Insufficient stock for "${name}". Available: ${current_stock}, Requested: ${quantity}`
      });
      await conn.rollback(); return;
    }

    const newStock = movement_type === 'IN'
      ? current_stock + Number(quantity)
      : current_stock - Number(quantity);

    await conn.execute('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, id]);
    const userId = getUserId(req);
    const [user]: any = await conn.query('SELECT name FROM users WHERE id = ?', [userId]);
    await conn.execute(
      `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) VALUES (?,?,?,?,?)`,
      [id, quantity, movement_type, reason?.trim() || null, user[0]?.name || 'Unknown']
    );

    await conn.commit();
    res.status(200).json({ success: true, message: 'Stock updated', data: { previous_stock: current_stock, new_stock: newStock, movement_type, quantity } });
  } catch (err: any) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  } finally { conn.release(); }
};
