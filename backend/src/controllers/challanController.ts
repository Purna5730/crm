import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest, getUserId } from '../middleware/auth';

// ── helpers ──────────────────────────────────────────────
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

const generateChallanNumber = async (conn: any): Promise<string> => {
  const d = new Date();
  const prefix = `CH-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const [rows]: any = await conn.query(
    `SELECT challan_number FROM challans WHERE challan_number LIKE ? ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );
  const seq = rows.length > 0 ? parseInt(rows[0].challan_number.split('-')[2]) + 1 : 1;
  return `${prefix}-${String(seq).padStart(4,'0')}`;
};

// ── GET /challans ─────────────────────────────────────────
export const getChallans = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, size, offset } = parsePage(req.query.page, req.query.limit);
    const search = getQueryString(req.query.search).trim();
    const status = getQueryString(req.query.status).trim();

    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      conditions.push('(c.challan_number LIKE ? OR c.customer_name LIKE ? OR c.customer_business LIKE ?)');
      params.push(...Array(3).fill(`%${search}%`));
    }
    if (status && ['draft','confirmed','cancelled'].includes(status)) {
      conditions.push('c.status = ?'); params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [[{ total }]]: any = await pool.query(
      `SELECT COUNT(*) as total FROM challans c ${where}`, params
    );
    const [rows]: any = await pool.query(
      `SELECT c.*, COUNT(ci.id) as item_count
       FROM challans c LEFT JOIN challan_items ci ON c.id = ci.challan_id
       ${where} GROUP BY c.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
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

// ── GET /challans/:id ─────────────────────────────────────
export const getChallan = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(getParamString(req.params.id));
  if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid challan ID' }); return; }
  try {
    const [rows]: any = await pool.query('SELECT * FROM challans WHERE id = ?', [id]);
    if (rows.length === 0) { res.status(404).json({ success: false, message: 'Challan not found' }); return; }
    const [items]: any = await pool.query('SELECT * FROM challan_items WHERE challan_id = ?', [id]);
    res.status(200).json({ success: true, data: { ...rows[0], items } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ── POST /challans ────────────────────────────────────────
export const createChallan = async (req: AuthRequest, res: Response): Promise<void> => {
  const { customer_id, items, status = 'draft', notes } = req.body;

  // Input validation
  if (!customer_id || isNaN(parseInt(customer_id))) {
    res.status(422).json({ success: false, message: 'Valid customer_id is required' }); return;
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(422).json({ success: false, message: 'At least one product item is required' }); return;
  }
  if (!['draft','confirmed'].includes(status)) {
    res.status(422).json({ success: false, message: 'Status must be draft or confirmed' }); return;
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.product_id || isNaN(parseInt(item.product_id))) {
      res.status(422).json({ success: false, message: `Item ${i+1}: valid product_id is required` }); return;
    }
    if (!item.quantity || parseInt(item.quantity) < 1) {
      res.status(422).json({ success: false, message: `Item ${i+1}: quantity must be at least 1` }); return;
    }
  }

  // Check duplicate product_ids
  const productIds = items.map((i: any) => parseInt(i.product_id));
  if (new Set(productIds).size !== productIds.length) {
    res.status(422).json({ success: false, message: 'Duplicate products in items. Use a single row per product.' }); return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Customer snapshot
    const [customers]: any = await conn.query('SELECT * FROM customers WHERE id = ?', [customer_id]);
    if (customers.length === 0) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      await conn.rollback(); return;
    }
    const customer = customers[0];

    const userId = getUserId(req);
    const [users]: any = await conn.query('SELECT name FROM users WHERE id = ?', [userId]);
    const createdBy = users[0]?.name || 'Unknown';

    // Resolve products + stock check
    let totalQty = 0, totalAmount = 0;
    const resolvedItems: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const [products]: any = await conn.query('SELECT * FROM products WHERE id = ?', [item.product_id]);
      if (products.length === 0) {
        res.status(404).json({ success: false, message: `Item ${i+1}: product not found (id: ${item.product_id})` });
        await conn.rollback(); return;
      }
      const product = products[0];
      const qty = parseInt(item.quantity);

      if (status === 'confirmed' && product.current_stock < qty) {
        res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.current_stock}, Requested: ${qty}`
        });
        await conn.rollback(); return;
      }

      const lineTotal = Number(product.unit_price) * qty;
      totalQty += qty;
      totalAmount += lineTotal;
      resolvedItems.push({ product_id: item.product_id, product, qty, lineTotal });
    }

    const challanNumber = await generateChallanNumber(conn);

    const [challanResult]: any = await conn.execute(
      `INSERT INTO challans (challan_number, customer_id, customer_name, customer_mobile, customer_business, customer_address, total_quantity, total_amount, status, created_by, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [challanNumber, customer_id, customer.name, customer.mobile, customer.business_name,
       customer.address, totalQty, totalAmount, status, createdBy, notes?.trim() || null]
    );
    const challanId = challanResult.insertId;

    for (const item of resolvedItems) {
      await conn.execute(
        `INSERT INTO challan_items (challan_id, product_id, product_name, product_sku, unit_price, quantity, total_price) VALUES (?,?,?,?,?,?,?)`,
        [challanId, item.product_id, item.product.name, item.product.sku, item.product.unit_price, item.qty, item.lineTotal]
      );
    }

    if (status === 'confirmed') {
      for (const item of resolvedItems) {
        await conn.execute('UPDATE products SET current_stock = current_stock - ? WHERE id = ?', [item.qty, item.product_id]);
        await conn.execute(
          `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) VALUES (?,?,?,?,?)`,
          [item.product_id, item.qty, 'OUT', `Challan ${challanNumber}`, createdBy]
        );
      }
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      message: `Challan ${status === 'confirmed' ? 'confirmed' : 'saved as draft'} successfully`,
      data: { id: challanId, challan_number: challanNumber, status, total_quantity: totalQty, total_amount: totalAmount }
    });
  } catch (err: any) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  } finally { conn.release(); }
};

// ── PATCH /challans/:id/status ────────────────────────────
export const updateChallanStatus = async (req: AuthRequest, res: Response): Promise<void> => {
const id = parseInt(getParamString(req.params.id));
  if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid challan ID' }); return; }

  const { status } = req.body;
  if (!['draft','confirmed','cancelled'].includes(status)) {
    res.status(422).json({ success: false, message: 'Status must be draft, confirmed or cancelled' }); return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows]: any = await conn.query('SELECT * FROM challans WHERE id = ?', [id]);
    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Challan not found' });
      await conn.rollback(); return;
    }
    const challan = rows[0];

    if (challan.status === 'cancelled') {
      res.status(400).json({ success: false, message: 'Cancelled challan cannot be modified' });
      await conn.rollback(); return;
    }
    if (challan.status === status) {
      res.status(400).json({ success: false, message: `Challan is already ${status}` });
      await conn.rollback(); return;
    }

    const userId = getUserId(req);
    const [users]: any = await conn.query('SELECT name FROM users WHERE id = ?', [userId]);
    const updatedBy = users[0]?.name || 'Unknown';
    const [items]: any = await conn.query('SELECT * FROM challan_items WHERE challan_id = ?', [id]);

    // draft → confirmed: deduct stock
    if (challan.status === 'draft' && status === 'confirmed') {
      for (const item of items) {
        const [prod]: any = await conn.query('SELECT current_stock FROM products WHERE id = ?', [item.product_id]);
        if (!prod.length || prod[0].current_stock < item.quantity) {
          res.status(400).json({
            success: false,
            message: `Insufficient stock for "${item.product_name}". Available: ${prod[0]?.current_stock ?? 0}, Required: ${item.quantity}`
          });
          await conn.rollback(); return;
        }
        await conn.execute('UPDATE products SET current_stock = current_stock - ? WHERE id = ?', [item.quantity, item.product_id]);
        await conn.execute(
          `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) VALUES (?,?,?,?,?)`,
          [item.product_id, item.quantity, 'OUT', `Challan ${challan.challan_number} confirmed`, updatedBy]
        );
      }
    }

    // confirmed → cancelled: restore stock
    if (challan.status === 'confirmed' && status === 'cancelled') {
      for (const item of items) {
        await conn.execute('UPDATE products SET current_stock = current_stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        await conn.execute(
          `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) VALUES (?,?,?,?,?)`,
          [item.product_id, item.quantity, 'IN', `Challan ${challan.challan_number} cancelled`, updatedBy]
        );
      }
    }

    await conn.execute('UPDATE challans SET status = ? WHERE id = ?', [status, id]);
    await conn.commit();
    res.status(200).json({ success: true, message: `Challan ${status} successfully` });
  } catch (err: any) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  } finally { conn.release(); }
};
