"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFollowUpNote = exports.addFollowUpNote = exports.deleteCustomer = exports.updateCustomer = exports.createCustomer = exports.getCustomer = exports.getCustomers = exports.customerValidation = void 0;
const express_validator_1 = require("express-validator");
const db_1 = __importDefault(require("../config/db"));
exports.customerValidation = [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Name is required'),
    (0, express_validator_1.body)('mobile').notEmpty().withMessage('Mobile is required'),
    (0, express_validator_1.body)('email').isEmail().withMessage('Valid email required'),
    (0, express_validator_1.body)('business_name').notEmpty().withMessage('Business name is required'),
    (0, express_validator_1.body)('customer_type').isIn(['retail', 'wholesale', 'distributor']).withMessage('Invalid customer type'),
    (0, express_validator_1.body)('address').notEmpty().withMessage('Address is required'),
    (0, express_validator_1.body)('status').isIn(['lead', 'active', 'inactive']).withMessage('Invalid status'),
];
const getCustomers = async (req, res) => {
    try {
        const search = req.query.search || '';
        const query = search
            ? `SELECT * FROM customers WHERE name LIKE ? OR mobile LIKE ? OR email LIKE ? OR business_name LIKE ? ORDER BY created_at DESC`
            : `SELECT * FROM customers ORDER BY created_at DESC`;
        const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`] : [];
        const [rows] = await db_1.default.query(query, params);
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getCustomers = getCustomers;
const getCustomer = async (req, res) => {
    try {
        const [rows] = await db_1.default.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }
        const [notes] = await db_1.default.query('SELECT * FROM follow_up_notes WHERE customer_id = ? ORDER BY created_at DESC', [req.params.id]);
        res.json({ ...rows[0], follow_up_notes: notes });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getCustomer = getCustomer;
const createCustomer = async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes } = req.body;
    try {
        const [result] = await db_1.default.execute(`INSERT INTO customers (name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [name, mobile, email, business_name, gst_number || null, customer_type, address, status || 'lead', follow_up_date || null, notes || null]);
        res.status(201).json({ id: result.insertId, message: 'Customer created' });
    }
    catch (err) {
        console.error('createCustomer error:', err);
        res.status(500).json({ message: err.message || err.sqlMessage || 'Server error' });
    }
};
exports.createCustomer = createCustomer;
const updateCustomer = async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes } = req.body;
    try {
        const [result] = await db_1.default.execute(`UPDATE customers SET name=?, mobile=?, email=?, business_name=?, gst_number=?, customer_type=?, address=?, status=?, follow_up_date=?, notes=? WHERE id=?`, [name, mobile, email, business_name, gst_number || null, customer_type, address, status, follow_up_date || null, notes || null, req.params.id]);
        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }
        res.json({ message: 'Customer updated' });
    }
    catch (err) {
        console.error('updateCustomer error:', err);
        res.status(500).json({ message: err.message || err.sqlMessage || 'Server error' });
    }
};
exports.updateCustomer = updateCustomer;
const deleteCustomer = async (req, res) => {
    try {
        const [result] = await db_1.default.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }
        res.json({ message: 'Customer deleted' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deleteCustomer = deleteCustomer;
const addFollowUpNote = async (req, res) => {
    const { note } = req.body;
    if (!note?.trim()) {
        res.status(400).json({ message: 'Note is required' });
        return;
    }
    try {
        const [user] = await db_1.default.query('SELECT name FROM users WHERE id = ?', [req.userId]);
        const createdBy = user[0]?.name || 'Unknown';
        await db_1.default.query('INSERT INTO follow_up_notes (customer_id, note, created_by) VALUES (?, ?, ?)', [req.params.id, note.trim(), createdBy]);
        res.status(201).json({ message: 'Note added' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.addFollowUpNote = addFollowUpNote;
const deleteFollowUpNote = async (req, res) => {
    try {
        await db_1.default.query('DELETE FROM follow_up_notes WHERE id = ? AND customer_id = ?', [req.params.noteId, req.params.id]);
        res.json({ message: 'Note deleted' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deleteFollowUpNote = deleteFollowUpNote;
