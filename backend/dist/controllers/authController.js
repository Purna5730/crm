"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = exports.loginValidation = exports.registerValidation = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_validator_1 = require("express-validator");
const db_1 = __importDefault(require("../config/db"));
const ROLES = ['admin', 'sales', 'warehouse', 'accounts'];
// ── helpers ──────────────────────────────────────────────
const validationError = (res, errors) => res.status(422).json({ success: false, errors: errors.array().map((e) => ({ field: e.path, message: e.msg })) });
// ── validation rules ─────────────────────────────────────
exports.registerValidation = [
    (0, express_validator_1.body)('name').trim().notEmpty().withMessage('Name is required'),
    (0, express_validator_1.body)('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    (0, express_validator_1.body)('role').isIn(ROLES).withMessage(`Role must be one of: ${ROLES.join(', ')}`),
];
exports.loginValidation = [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required'),
    (0, express_validator_1.body)('role').isIn(ROLES).withMessage(`Role must be one of: ${ROLES.join(', ')}`),
];
// ── POST /auth/register ───────────────────────────────────
const register = async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        validationError(res, errors);
        return;
    }
    const { name, email, password, role } = req.body;
    try {
        const [existing] = await db_1.default.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            res.status(409).json({ success: false, message: 'Email already registered' });
            return;
        }
        const hash = await bcryptjs_1.default.hash(password, 10);
        const [result] = await db_1.default.execute('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hash, role]);
        res.status(201).json({ success: true, message: 'Registration successful', data: { id: result.insertId, name, email, role } });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.sqlMessage || err.message });
    }
};
exports.register = register;
// ── POST /auth/login ──────────────────────────────────────
const login = async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        validationError(res, errors);
        return;
    }
    const { email, password, role } = req.body;
    try {
        const [rows] = await db_1.default.query('SELECT * FROM users WHERE email = ? AND role = ?', [email, role]);
        if (rows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid email, password or role' });
            return;
        }
        const user = rows[0];
        const match = await bcryptjs_1.default.compare(password, user.password);
        if (!match) {
            res.status(401).json({ success: false, message: 'Invalid email, password or role' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } }
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.sqlMessage || err.message });
    }
};
exports.login = login;
