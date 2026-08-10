import { Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth';

// ── helpers ──────────────────────────────────────────────
const validationError = (res: Response, errors: any) =>
  res.status(422).json({ success: false, errors: errors.array().map((e: any) => ({ field: e.path, message: e.msg })) });

const parsePage = (p: any, limit: any) => {
  const page = Math.max(1, parseInt(p) || 1);
  const size = Math.min(100, Math.max(1, parseInt(limit) || 20));
  return { page, size, offset: (page - 1) * size };
};

// ── validation rules ─────────────────────────────────────
export const customerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('mobile').trim().notEmpty().withMessage('Mobile is required')
    .matches(/^[0-9+\-\s]{7,15}$/).withMessage('Invalid mobile number'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('business_name').trim().notEmpty().withMessage('Business name is required'),
  body('customer_type').isIn(['retail', 'wholesale', 'distributor']).withMessage('Type must be retail, wholesale or distributor'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('status').isIn(['lead', 'active', 'inactive']).withMessage('Status must be lead, active or inactive'),
  body('gst_number').optional({ nullable: true, checkFalsy: true })
    .matches(/^[0-9A-Z]{15}$/).withMessage('GST number must be 15 alphanumeric characters'),
  body('follow_up_date').optional({ nullable: true, checkFalsy: true })
    .isDate().withMessage('Follow-up date must be a valid date (YYYY-MM-DD)'),
];

// ── GET /customers ────────────────────────────────────────
export const getCustomers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, size, offset } = parsePage(req.query.page, req.query.limit);
    const search  = (req.query.search  as string || '').trim();
    const status  = (req.query.status  as string || '').trim();
    const type    = (req.query.type    as string || '').trim();

    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      conditions.push('(name LIKE ? OR mobile LIKE ? OR email LIKE ? OR business_name LIKE ?)');
      params.push(...Array(4).fill(`%${search}%`));
    }
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (type)   { conditions.push('customer_type = ?'); params.push(type); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]]: any = await pool.query(`SELECT COUNT(*) as total FROM customers ${where}`, params);
    const [rows]: any = await pool.query(
      `SELECT id, name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, created_at
       FROM customers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
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

// ── GET /customers/:id ────────────────────────────────────
export const getCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid customer ID' }); return; }
  try {
    const [rows]: any = await pool.query('SELECT * FROM customers WHERE id = ?', [id]);
    if (rows.length === 0) { res.status(404).json({ success: false, message: 'Customer not found' }); return; }
    const [notes]: any = await pool.query(
      'SELECT id, note, created_by, created_at FROM follow_up_notes WHERE customer_id = ? ORDER BY created_at DESC', [id]
    );
    res.status(200).json({ success: true, data: { ...rows[0], follow_up_notes: notes } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ── POST /customers ───────────────────────────────────────
export const createCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { validationError(res, errors); return; }

  const { name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes } = req.body;
  try {
    const [existing]: any = await pool.query('SELECT id FROM customers WHERE email = ?', [email]);
    if (existing.length > 0) {
      res.status(409).json({ success: false, message: 'Email already exists for another customer' }); return;
    }
    const [result]: any = await pool.execute(
      `INSERT INTO customers (name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, mobile, email, business_name, gst_number || null, customer_type, address, status, follow_up_date || null, notes || null]
    );
    res.status(201).json({ success: true, message: 'Customer created successfully', data: { id: result.insertId } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ── PUT /customers/:id ────────────────────────────────────
export const updateCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid customer ID' }); return; }

  const errors = validationResult(req);
  if (!errors.isEmpty()) { validationError(res, errors); return; }

  const { name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes } = req.body;
  try {
    const [existing]: any = await pool.query('SELECT id FROM customers WHERE email = ? AND id != ?', [email, id]);
    if (existing.length > 0) {
      res.status(409).json({ success: false, message: 'Email already used by another customer' }); return;
    }
    const [result]: any = await pool.execute(
      `UPDATE customers SET name=?, mobile=?, email=?, business_name=?, gst_number=?, customer_type=?, address=?, status=?, follow_up_date=?, notes=? WHERE id=?`,
      [name, mobile, email, business_name, gst_number || null, customer_type, address, status, follow_up_date || null, notes || null, id]
    );
    if (result.affectedRows === 0) { res.status(404).json({ success: false, message: 'Customer not found' }); return; }
    res.status(200).json({ success: true, message: 'Customer updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ── DELETE /customers/:id ─────────────────────────────────
export const deleteCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid customer ID' }); return; }
  try {
    const [result]: any = await pool.execute('DELETE FROM customers WHERE id = ?', [id]);
    if (result.affectedRows === 0) { res.status(404).json({ success: false, message: 'Customer not found' }); return; }
    res.status(200).json({ success: true, message: 'Customer deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ── POST /customers/:id/notes ─────────────────────────────
export const addFollowUpNote = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid customer ID' }); return; }

  const note = req.body.note?.trim();
  if (!note) { res.status(422).json({ success: false, message: 'Note text is required' }); return; }

  try {
    const [customer]: any = await pool.query('SELECT id FROM customers WHERE id = ?', [id]);
    if (customer.length === 0) { res.status(404).json({ success: false, message: 'Customer not found' }); return; }

    const [user]: any = await pool.query('SELECT name FROM users WHERE id = ?', [req.userId]);
    const [result]: any = await pool.execute(
      'INSERT INTO follow_up_notes (customer_id, note, created_by) VALUES (?, ?, ?)',
      [id, note, user[0]?.name || 'Unknown']
    );
    res.status(201).json({ success: true, message: 'Note added', data: { id: result.insertId } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ── DELETE /customers/:id/notes/:noteId ───────────────────
export const deleteFollowUpNote = async (req: AuthRequest, res: Response): Promise<void> => {
  const id     = parseInt(req.params.id);
  const noteId = parseInt(req.params.noteId);
  if (isNaN(id) || isNaN(noteId)) { res.status(400).json({ success: false, message: 'Invalid ID' }); return; }
  try {
    const [result]: any = await pool.execute(
      'DELETE FROM follow_up_notes WHERE id = ? AND customer_id = ?', [noteId, id]
    );
    if (result.affectedRows === 0) { res.status(404).json({ success: false, message: 'Note not found' }); return; }
    res.status(200).json({ success: true, message: 'Note deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};
