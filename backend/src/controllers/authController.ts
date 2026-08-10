import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../config/db';

const ROLES = ['admin', 'sales', 'warehouse', 'accounts'] as const;

// ── helpers ──────────────────────────────────────────────
const validationError = (res: Response, errors: any) =>
  res.status(422).json({ success: false, errors: errors.array().map((e: any) => ({ field: e.path, message: e.msg })) });

// ── validation rules ─────────────────────────────────────
export const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(ROLES).withMessage(`Role must be one of: ${ROLES.join(', ')}`),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('role').isIn(ROLES).withMessage(`Role must be one of: ${ROLES.join(', ')}`),
];

// ── POST /auth/register ───────────────────────────────────
export const register = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { validationError(res, errors); return; }

  const { name, email, password, role } = req.body;
  try {
    const [existing]: any = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      res.status(409).json({ success: false, message: 'Email already registered' }); return;
    }
    const hash = await bcrypt.hash(password, 10);
    const [result]: any = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hash, role]
    );
    res.status(201).json({ success: true, message: 'Registration successful', data: { id: result.insertId, name, email, role } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};

// ── POST /auth/login ──────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { validationError(res, errors); return; }

  const { email, password, role } = req.body;
  try {
    const [rows]: any = await pool.query('SELECT * FROM users WHERE email = ? AND role = ?', [email, role]);
    if (rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid email, password or role' }); return;
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(401).json({ success: false, message: 'Invalid email, password or role' }); return;
    }
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '1d' });
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.sqlMessage || err.message });
  }
};
