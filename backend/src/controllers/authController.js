const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createAuditLog } = require('../middleware/auditLog');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/v1/auth/register  (Admin only)
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await User.create({ name, email, password, role });
    await createAuditLog({ userId: req.user?._id, entityType: 'user', entityId: user._id, action: 'create', after: { name, email, role }, req });
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
};

// POST /api/v1/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'E-Mail und Passwort erforderlich' });

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Ungültige Anmeldedaten' });

    if (!user.isActive)
      return res.status(401).json({ message: 'Konto ist deaktiviert' });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    res.json({ success: true, token, user });
  } catch (err) { next(err); }
};

// GET /api/v1/auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, data: req.user });
};

// PUT /api/v1/auth/password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.comparePassword(currentPassword)))
      return res.status(401).json({ message: 'Aktuelles Passwort falsch' });

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Passwort erfolgreich geändert' });
  } catch (err) { next(err); }
};
