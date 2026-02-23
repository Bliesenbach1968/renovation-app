const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * JWT-Authentifizierungs-Middleware
 * Liest den Bearer-Token aus dem Authorization-Header und setzt req.user
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Nicht authentifiziert – kein Token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) return res.status(401).json({ message: 'Nutzer nicht gefunden' });
    if (!user.isActive) return res.status(401).json({ message: 'Nutzerkonto ist deaktiviert' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token ungültig oder abgelaufen' });
  }
};

module.exports = authenticate;
