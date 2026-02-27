const User = require('../models/User');
const { createAuditLog } = require('../middleware/auditLog');

// GET /api/v1/users
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ name: 1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (err) { next(err); }
};

// GET /api/v1/users/:id
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Nutzer nicht gefunden' });
    // Eigenes Profil oder Admin darf sehen
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id)
      return res.status(403).json({ message: 'Kein Zugriff' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// PUT /api/v1/users/:id
exports.updateUser = async (req, res, next) => {
  try {
    const { name, email, role, isActive } = req.body;
    const isOwn = req.user._id.toString() === req.params.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwn && !isAdmin) return res.status(403).json({ message: 'Kein Zugriff' });

    const updateData = { name, email };
    if (isAdmin) { updateData.role = role; updateData.isActive = isActive; }

    const before = await User.findById(req.params.id);
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: 'Nutzer nicht gefunden' });

    await createAuditLog({ userId: req.user._id, entityType: 'user', entityId: user._id, action: 'update', before: before.toJSON(), after: user.toJSON(), req });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// PUT /api/v1/users/:id/password  (Admin setzt neues Passwort)
exports.resetUserPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ message: 'Passwort muss mindestens 8 Zeichen haben' });

    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ message: 'Nutzer nicht gefunden' });

    user.password = newPassword;
    await user.save();

    await createAuditLog({ userId: req.user._id, entityType: 'user', entityId: user._id, action: 'update', before: { password: '[gesetzt]' }, after: { password: '[neu gesetzt]' }, req });
    res.json({ success: true, message: 'Passwort erfolgreich zurückgesetzt' });
  } catch (err) { next(err); }
};

// DELETE /api/v1/users/:id  (Hard-Delete)
exports.deactivateUser = async (req, res, next) => {
  try {
    if (req.user._id.toString() === req.params.id)
      return res.status(400).json({ message: 'Sie können sich nicht selbst löschen' });
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'Nutzer nicht gefunden' });
    await createAuditLog({ userId: req.user._id, entityType: 'user', entityId: user._id, action: 'delete', before: user.toJSON(), after: null, req });
    res.json({ success: true, message: 'Nutzer gelöscht' });
  } catch (err) { next(err); }
};
