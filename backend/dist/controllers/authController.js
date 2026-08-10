"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.loginValidation = exports.register = exports.registerValidation = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_validator_1 = require("express-validator");
const db_1 = __importDefault(require("../config/db"));
const ROLES = ['admin', 'sales', 'warehouse', 'accounts'];
exports.registerValidation = [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Name is required'),
    (0, express_validator_1.body)('email').isEmail().withMessage('Valid email required'),
    (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
    (0, express_validator_1.body)('role').isIn(ROLES).withMessage('Invalid role'),
];
const register = async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { name, email, password, role } = req.body;
    try {
        const [rows] = await db_1.default.query('SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length > 0) {
            res.status(409).json({ message: 'Email already exists' });
            return;
        }
        const hash = await bcryptjs_1.default.hash(password, 10);
        await db_1.default.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hash, role]);
        res.status(201).json({ message: 'User registered successfully' });
    }
    catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({ message: err.message || 'Server error' });
    }
};
exports.register = register;
exports.loginValidation = [
    (0, express_validator_1.body)('email').isEmail().withMessage('Valid email required'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password required'),
    (0, express_validator_1.body)('role').isIn(ROLES).withMessage('Invalid role'),
];
const login = async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { email, password, role } = req.body;
    try {
        const [rows] = await db_1.default.query('SELECT * FROM users WHERE email = ? AND role = ?', [email, role]);
        if (rows.length === 0) {
            res.status(401).json({ message: 'Invalid credentials or role mismatch' });
            return;
        }
        const user = rows[0];
        const match = await bcryptjs_1.default.compare(password, user.password);
        if (!match) {
            res.status(401).json({ message: 'Invalid credentials or role mismatch' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    }
    catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ message: err.message || 'Server error' });
    }
};
exports.login = login;
