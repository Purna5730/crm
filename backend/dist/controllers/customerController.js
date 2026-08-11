"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFollowUpNote = exports.addFollowUpNote = exports.deleteCustomer = exports.updateCustomer = exports.createCustomer = exports.getCustomer = exports.getCustomers = exports.customerValidation = void 0;
const express_validator_1 = require("express-validator");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
// ── helpers ──────────────────────────────────────────────
const validationError = (res, errors) => res.status(422).json({ success: false, errors: errors.array().map((e) => ({ field: e.path, message: e.msg })) });
const parsePage = (p, limit) => {
    const pageValue = typeof p === 'string'
        ? p
        : Array.isArray(p) && typeof p[0] === 'string'
            ? p[0]
            : '';
    const limitValue = typeof limit === 'string'
        ? limit
        : Array.isArray(limit) && typeof limit[0] === 'string'
            ? limit[0]
            : '';
    const page = Math.max(1, parseInt(pageValue, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(limitValue, 10) || 20));
    return { page, size, offset: (page - 1) * size };
};
const getQueryString = (value) => {
    if (typeof value === 'string')
        return value;
    if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
    }
    return '';
};
const getParamString = (value) => {
    if (typeof value === 'string')
        return value;
    if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
    }
    return '';
};
// ── validation rules ─────────────────────────────────────
exports.customerValidation = [
    (0, express_validator_1.body)('name').trim().notEmpty().withMessage('Name is required'),
    (0, express_validator_1.body)('mobile').trim().notEmpty().withMessage('Mobile is required')
        .matches(/^[0-9+\-\s]{7,15}$/).withMessage('Invalid mobile number'),
    (0, express_validator_1.body)('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('business_name').trim().notEmpty().withMessage('Business name is required'),
    (0, express_validator_1.body)('customer_type').isIn(['retail', 'wholesale', 'distributor']).withMessage('Type must be retail, wholesale or distributor'),
    (0, express_validator_1.body)('address').trim().notEmpty().withMessage('Address is required'),
    (0, express_validator_1.body)('status').isIn(['lead', 'active', 'inactive']).withMessage('Status must be lead, active or inactive'),
    (0, express_validator_1.body)('gst_number').optional({ nullable: true, checkFalsy: true })
        .matches(/^[0-9A-Z]{15}$/).withMessage('GST number must be 15 alphanumeric characters'),
    (0, express_validator_1.body)('follow_up_date').optional({ nullable: true, checkFalsy: true })
        .isDate().withMessage('Follow-up date must be a valid date (YYYY-MM-DD)'),
];
// ── GET /customers ────────────────────────────────────────
const getCustomers = async (req, res) => {
    try {
        const { page, size, offset } = parsePage(req.query.page, req.query.limit);
        const search = getQueryString(req.query.search).trim();
        const status = getQueryString(req.query.status).trim();
        const type = getQueryString(req.query.type).trim();
        const conditions = [];
        const params = [];
        if (search) {
            conditions.push('(name LIKE ? OR mobile LIKE ? OR email LIKE ? OR business_name LIKE ?)');
            params.push(...Array(4).fill(`%${search}%`));
        }
        if (status) {
            conditions.push('status = ?');
            params.push(status);
        }
        if (type) {
            conditions.push('customer_type = ?');
            params.push(type);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const [[{ total }]] = await db_1.default.query(`SELECT COUNT(*) as total FROM customers ${where}`, params);
        const [rows] = await db_1.default.query(`SELECT id, name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, created_at
       FROM customers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, size, offset]);
        res.status(200).json({
            success: true,
            data: rows,
            pagination: { total, page, limit: size, pages: Math.ceil(total / size) }
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.sqlMessage || err.message });
    }
};
exports.getCustomers = getCustomers;
// ── GET /customers/:id ────────────────────────────────────
const getCustomer = async (req, res) => {
    const id = parseInt(getParamString(req.params.id));
    if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid customer ID' });
        return;
    }
    try {
        const [rows] = await db_1.default.query('SELECT * FROM customers WHERE id = ?', [id]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Customer not found' });
            return;
        }
        const [notes] = await db_1.default.query('SELECT id, note, created_by, created_at FROM follow_up_notes WHERE customer_id = ? ORDER BY created_at DESC', [id]);
        res.status(200).json({ success: true, data: { ...rows[0], follow_up_notes: notes } });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.sqlMessage || err.message });
    }
};
exports.getCustomer = getCustomer;
// ── POST /customers ───────────────────────────────────────
const createCustomer = async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        validationError(res, errors);
        return;
    }
    const { name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes } = req.body;
    try {
        const [existing] = await db_1.default.query('SELECT id FROM customers WHERE email = ?', [email]);
        if (existing.length > 0) {
            res.status(409).json({ success: false, message: 'Email already exists for another customer' });
            return;
        }
        const [result] = await db_1.default.execute(`INSERT INTO customers (name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [name, mobile, email, business_name, gst_number || null, customer_type, address, status, follow_up_date || null, notes || null]);
        res.status(201).json({ success: true, message: 'Customer created successfully', data: { id: result.insertId } });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.sqlMessage || err.message });
    }
};
exports.createCustomer = createCustomer;
// ── PUT /customers/:id ────────────────────────────────────
const updateCustomer = async (req, res) => {
    const id = parseInt(getParamString(req.params.id));
    if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid customer ID' });
        return;
    }
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        validationError(res, errors);
        return;
    }
    const { name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes } = req.body;
    try {
        const [existing] = await db_1.default.query('SELECT id FROM customers WHERE email = ? AND id != ?', [email, id]);
        if (existing.length > 0) {
            res.status(409).json({ success: false, message: 'Email already used by another customer' });
            return;
        }
        const [result] = await db_1.default.execute(`UPDATE customers SET name=?, mobile=?, email=?, business_name=?, gst_number=?, customer_type=?, address=?, status=?, follow_up_date=?, notes=? WHERE id=?`, [name, mobile, email, business_name, gst_number || null, customer_type, address, status, follow_up_date || null, notes || null, id]);
        if (result.affectedRows === 0) {
            res.status(404).json({ success: false, message: 'Customer not found' });
            return;
        }
        res.status(200).json({ success: true, message: 'Customer updated successfully' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.sqlMessage || err.message });
    }
};
exports.updateCustomer = updateCustomer;
// ── DELETE /customers/:id ─────────────────────────────────
const deleteCustomer = async (req, res) => {
    const id = parseInt(getParamString(req.params.id));
    if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid customer ID' });
        return;
    }
    try {
        const [result] = await db_1.default.execute('DELETE FROM customers WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            res.status(404).json({ success: false, message: 'Customer not found' });
            return;
        }
        res.status(200).json({ success: true, message: 'Customer deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.sqlMessage || err.message });
    }
};
exports.deleteCustomer = deleteCustomer;
// ── POST /customers/:id/notes ─────────────────────────────
const addFollowUpNote = async (req, res) => {
    const id = parseInt(getParamString(req.params.id));
    if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid customer ID' });
        return;
    }
    const note = req.body.note?.trim();
    if (!note) {
        res.status(422).json({ success: false, message: 'Note text is required' });
        return;
    }
    try {
        const [customer] = await db_1.default.query('SELECT id FROM customers WHERE id = ?', [id]);
        if (customer.length === 0) {
            res.status(404).json({ success: false, message: 'Customer not found' });
            return;
        }
        const userId = (0, auth_1.getUserId)(req);
        const [user] = await db_1.default.query('SELECT name FROM users WHERE id = ?', [userId]);
        const [result] = await db_1.default.execute('INSERT INTO follow_up_notes (customer_id, note, created_by) VALUES (?, ?, ?)', [id, note, user[0]?.name || 'Unknown']);
        res.status(201).json({ success: true, message: 'Note added', data: { id: result.insertId } });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.sqlMessage || err.message });
    }
};
exports.addFollowUpNote = addFollowUpNote;
// ── DELETE /customers/:id/notes/:noteId ───────────────────
const deleteFollowUpNote = async (req, res) => {
    const id = parseInt(getParamString(req.params.id));
    const noteId = parseInt(getParamString(req.params.noteId));
    if (isNaN(id) || isNaN(noteId)) {
        res.status(400).json({ success: false, message: 'Invalid ID' });
        return;
    }
    try {
        const [result] = await db_1.default.execute('DELETE FROM follow_up_notes WHERE id = ? AND customer_id = ?', [noteId, id]);
        if (result.affectedRows === 0) {
            res.status(404).json({ success: false, message: 'Note not found' });
            return;
        }
        res.status(200).json({ success: true, message: 'Note deleted' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.sqlMessage || err.message });
    }
};
exports.deleteFollowUpNote = deleteFollowUpNote;
