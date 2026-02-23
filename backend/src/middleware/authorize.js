const Project = require('../models/Project');

/**
 * Rollenbasierte Zugriffskontrolle
 * @param {...string} roles - Erlaubte Rollen
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Nicht authentifiziert' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      message: `Zugriff verweigert – Rolle '${req.user.role}' hat keine Berechtigung`,
    });
  }
  next();
};

/**
 * Prüft ob der Nutzer Zugriff auf ein bestimmtes Projekt hat
 * Admins haben immer Zugriff. Alle anderen müssen im Team sein.
 */
const authorizeProjectAccess = async (req, res, next) => {
  if (req.user.role === 'admin') return next();

  const projectId = req.params.projectId || req.params.id || req.body.projectId;
  if (!projectId) return next();

  try {
    const project = await Project.findById(projectId).select('team createdBy');
    if (!project) return res.status(404).json({ message: 'Projekt nicht gefunden' });

    const isTeamMember = project.team.some(
      (t) => t.userId.toString() === req.user._id.toString()
    );
    const isCreator = project.createdBy?.toString() === req.user._id.toString();

    if (!isTeamMember && !isCreator) {
      return res.status(403).json({ message: 'Kein Zugriff auf dieses Projekt' });
    }
    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Gibt die Rolle des Nutzers im Projekt zurück
 */
const getProjectRole = (project, userId) => {
  const member = project.team.find((t) => t.userId.toString() === userId.toString());
  return member?.role || null;
};

module.exports = { authorize, authorizeProjectAccess, getProjectRole };
