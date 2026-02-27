const jwt = require('jsonwebtoken');
const crypto = require('crypto');
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

// POST /api/v1/auth/forgot-password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'E-Mail erforderlich' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Kein Hinweis ob Nutzer existiert (Sicherheit)
      return res.json({ success: true, message: 'Wenn diese E-Mail registriert ist, wurde ein Reset-Link generiert.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 Stunde
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, resetToken: rawToken });
  } catch (err) { next(err); }
};

// POST /api/v1/auth/reset-password
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: 'Token und Passwort erforderlich' });
    if (password.length < 8) return res.status(400).json({ message: 'Passwort muss mindestens 8 Zeichen haben' });

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) return res.status(400).json({ message: 'Reset-Link ungültig oder abgelaufen' });

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Passwort erfolgreich zurückgesetzt' });
  } catch (err) { next(err); }
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
