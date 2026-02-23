const mongoose = require('mongoose');
const Project = require('../models/Project');
const Position = require('../models/Position');
const Container = require('../models/Container');
const Geruest = require('../models/Geruest');
const Kran = require('../models/Kran');
const { generateProjectNumber } = require('../utils/projectNumber');
const { calculateDelay } = require('../utils/calculations');
const { createAuditLog } = require('../middleware/auditLog');

// GET /api/v1/projects
exports.getProjects = async (req, res, next) => {
  try {
    const filter =
      req.user.role === 'admin'
        ? {}
        : { $or: [{ createdBy: req.user._id }, { 'team.userId': req.user._id }] };

    const { status, search } = req.query;
    if (status) filter.status = status;
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { projectNumber: { $regex: search, $options: 'i' } },
      { 'address.city': { $regex: search, $options: 'i' } },
    ];

    const projects = await Project.find(filter)
      .populate('createdBy', 'name email')
      .populate('team.userId', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: projects.length, data: projects });
  } catch (err) { next(err); }
};

// Hilfsfunktion: Etagenname anhand Level
function getFloorName(level) {
  if (level === 0)  return 'Erdgeschoss';
  if (level > 0)   return `${level}. Obergeschoss`;
  if (level === -1) return 'Keller';
  if (level === -2) return 'Tiefgarage';
  if (level === -3) return 'Tiefgarage 2. UG';
  return `Etage ${level}`;
}

// POST /api/v1/projects
exports.createProject = async (req, res, next) => {
  try {
    const projectNumber = await generateProjectNumber();
    const { phaseTimelines = {} } = req.body;
    const project = await Project.create({
      ...req.body,
      projectNumber,
      createdBy: req.user._id,
      phases: [
        { type: 'demolition',          name: 'Entkernung',     order: 1, timeline: phaseTimelines.demolition          || {} },
        { type: 'renovation',          name: 'Renovierung',    order: 2, timeline: phaseTimelines.renovation          || {} },
        { type: 'specialConstruction', name: 'Sonderarbeiten', order: 3, timeline: phaseTimelines.specialConstruction || {} },
      ],
    });

    const Floor = require('../models/Floor');
    const floorsToCreate = [];

    // Tiefgarage (unterste Ebene)
    if (project.tiefgarage) {
      floorsToCreate.push({ level: -2, name: getFloorName(-2), order: -2 });
    }

    // Kelleretagen
    const kellerAnzahl = project.kellerAnzahl || 0;
    for (let k = 0; k < kellerAnzahl; k++) {
      const level = -1 - k;
      floorsToCreate.push({ level, name: kellerAnzahl === 1 ? 'Keller' : `${k + 1}. Keller`, order: level });
    }

    // Oberirdische Etagen (EG + Obergeschosse)
    const etagenOhneKeller = project.etagenOhneKeller || 0;
    for (let e = 0; e < etagenOhneKeller; e++) {
      floorsToCreate.push({ level: e, name: getFloorName(e), order: e });
    }

    // Alle Entkernung/Renovierung-Etagen anlegen (phaseType: null → sichtbar in beiden Phasen)
    if (floorsToCreate.length > 0) {
      await Floor.insertMany(
        floorsToCreate.map((f) => ({ ...f, projectId: project._id, phaseType: null }))
      );
    }

    // Standard-Sonderarbeiten-Etage (Dachgeschoss)
    await Floor.create({
      projectId: project._id,
      name: 'Dachgeschoss',
      level: 20,
      order: 20,
      phaseType: 'specialConstruction',
    });

    await createAuditLog({ userId: req.user._id, projectId: project._id, entityType: 'project', entityId: project._id, action: 'create', after: project.toJSON(), req });
    res.status(201).json({ success: true, data: project });
  } catch (err) { next(err); }
};

// GET /api/v1/projects/:id
exports.getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('team.userId', 'name email role');
    if (!project) return res.status(404).json({ message: 'Projekt nicht gefunden' });
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
};

// PUT /api/v1/projects/:id
exports.updateProject = async (req, res, next) => {
  try {
    const before = await Project.findById(req.params.id);

    // phaseTimelines separat verarbeiten, nicht direkt als Feld speichern
    const { phaseTimelines, ...updateBody } = req.body;
    let project = await Project.findByIdAndUpdate(req.params.id, updateBody, {
      new: true, runValidators: true,
    });
    if (!project) return res.status(404).json({ message: 'Projekt nicht gefunden' });

    // Phasen-Timelines einzeln aktualisieren
    if (phaseTimelines) {
      for (const phase of project.phases) {
        const t = phaseTimelines[phase.type];
        if (t) {
          phase.timeline = {
            plannedStart: t.plannedStart || undefined,
            plannedEnd:   t.plannedEnd   || undefined,
          };
        }
      }
      await project.save();
    }

    // Wenn Status auf 'active' gesetzt wird, alle Phasen ebenfalls auf 'active' setzen
    if (req.body.status === 'active') {
      await Project.updateOne(
        { _id: req.params.id },
        { $set: { 'phases.$[].status': 'active' } }
      );
      project = await Project.findById(req.params.id)
        .populate('createdBy', 'name email')
        .populate('team.userId', 'name email role');
    }

    await createAuditLog({ userId: req.user._id, projectId: project._id, entityType: 'project', entityId: project._id, action: 'update', before: before?.toJSON(), after: project.toJSON(), req });
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
};

// DELETE /api/v1/projects/:id  (Admin only)
exports.deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Projekt nicht gefunden' });
    await Project.findByIdAndDelete(req.params.id);
    // Zugehörige Daten bereinigen
    await Promise.all([
      require('../models/Floor').deleteMany({ projectId: req.params.id }),
      require('../models/Room').deleteMany({ projectId: req.params.id }),
      Position.deleteMany({ projectId: req.params.id }),
      Container.deleteMany({ projectId: req.params.id }),
      Geruest.deleteMany({ projectId: req.params.id }),
      Kran.deleteMany({ projectId: req.params.id }),
    ]);
    await createAuditLog({ userId: req.user._id, projectId: req.params.id, entityType: 'project', entityId: req.params.id, action: 'delete', before: project.toJSON(), req });
    res.json({ success: true, message: 'Projekt gelöscht' });
  } catch (err) { next(err); }
};

// POST /api/v1/projects/:id/team
exports.addTeamMember = async (req, res, next) => {
  try {
    const { userId, role } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Projekt nicht gefunden' });

    const exists = project.team.some((t) => t.userId.toString() === userId);
    if (exists) return res.status(409).json({ message: 'Nutzer ist bereits Teammitglied' });

    project.team.push({ userId, role: role || 'worker' });
    await project.save();
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
};

// DELETE /api/v1/projects/:id/team/:userId
exports.removeTeamMember = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Projekt nicht gefunden' });
    project.team = project.team.filter((t) => t.userId.toString() !== req.params.userId);
    await project.save();
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
};

// GET /api/v1/projects/:id/summary — Gesamtkalkulation
exports.getProjectSummary = async (req, res, next) => {
  try {
    const projectId = new mongoose.Types.ObjectId(req.params.id);

    const positionAgg = await Position.aggregate([
      { $match: { projectId } },
      {
        $group: {
          _id: '$phaseType',
          materialCost: { $sum: '$materialCost' },
          disposalCost: { $sum: '$disposalCost' },
          laborCost:    { $sum: '$laborCost' },
          totalCost:    { $sum: '$totalCost' },
          totalHours:   { $sum: { $multiply: ['$quantity', '$laborHoursPerUnit'] } },
          positionCount: { $sum: 1 },
        },
      },
    ]);

    const containerAgg = await Container.aggregate([
      { $match: { projectId } },
      { $group: { _id: '$phaseType', containerCost: { $sum: '$totalCost' } } },
    ]);

    const geruestAgg = await Geruest.aggregate([
      { $match: { projectId } },
      { $group: { _id: '$phaseType', geruestCost: { $sum: '$totalCost' } } },
    ]);

    const kranAgg = await Kran.aggregate([
      { $match: { projectId } },
      { $group: { _id: '$phaseType', kranCost: { $sum: '$totalCost' } } },
    ]);

    const phaseMap = {};
    ['demolition', 'renovation', 'specialConstruction'].forEach((p) => {
      phaseMap[p] = { materialCost: 0, disposalCost: 0, laborCost: 0, containerCost: 0, geruestCost: 0, kranCost: 0, subtotal: 0, totalHours: 0, positionCount: 0 };
    });

    positionAgg.forEach((p) => {
      if (phaseMap[p._id]) {
        phaseMap[p._id].materialCost  = +p.materialCost.toFixed(2);
        phaseMap[p._id].disposalCost  = +p.disposalCost.toFixed(2);
        phaseMap[p._id].laborCost     = +p.laborCost.toFixed(2);
        phaseMap[p._id].totalHours    = +p.totalHours.toFixed(1);
        phaseMap[p._id].positionCount = p.positionCount;
      }
    });
    containerAgg.forEach((c) => {
      if (phaseMap[c._id]) phaseMap[c._id].containerCost = +c.containerCost.toFixed(2);
    });
    geruestAgg.forEach((g) => {
      if (phaseMap[g._id]) phaseMap[g._id].geruestCost = +g.geruestCost.toFixed(2);
    });
    kranAgg.forEach((k) => {
      if (phaseMap[k._id]) phaseMap[k._id].kranCost = +k.kranCost.toFixed(2);
    });

    const grandTotal = { materialCost: 0, disposalCost: 0, laborCost: 0, containerCost: 0, geruestCost: 0, kranCost: 0, grandTotal: 0, totalHours: 0 };
    Object.keys(phaseMap).forEach((phase) => {
      const p = phaseMap[phase];
      p.subtotal = +(p.materialCost + p.disposalCost + p.laborCost + p.containerCost + p.geruestCost + p.kranCost).toFixed(2);
      grandTotal.materialCost  += p.materialCost;
      grandTotal.disposalCost  += p.disposalCost;
      grandTotal.laborCost     += p.laborCost;
      grandTotal.containerCost += p.containerCost;
      grandTotal.geruestCost   += p.geruestCost;
      grandTotal.kranCost      += p.kranCost;
      grandTotal.grandTotal    += p.subtotal;
      grandTotal.totalHours    += p.totalHours;
    });

    Object.keys(grandTotal).forEach((k) => { grandTotal[k] = +grandTotal[k].toFixed(2); });

    res.json({ success: true, data: { phases: phaseMap, totals: grandTotal } });
  } catch (err) { next(err); }
};

// GET /api/v1/projects/:id/timeline — Zeitplanauswertung
exports.getTimeline = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Projekt nicht gefunden' });

    const phases = project.phases.map((phase) => {
      const tl = phase.timeline || {};
      const delay = calculateDelay(tl.plannedStart, tl.plannedEnd, tl.actualStart, tl.actualEnd);
      return {
        phaseType: phase.type,
        phaseName: phase.name,
        status:    phase.status,
        order:     phase.order,
        planned: { start: tl.plannedStart, end: tl.plannedEnd },
        actual:  { start: tl.actualStart,  end: tl.actualEnd  },
        delay,
      };
    });

    // Gesamtprojekt-Zeitplan
    const projectDelay = calculateDelay(
      project.timeline?.plannedStart,
      project.timeline?.plannedEnd,
      project.timeline?.actualStart,
      project.timeline?.actualEnd
    );

    res.json({
      success: true,
      data: {
        projectId:       project._id,
        projectTimeline: project.timeline,
        projectDelay,
        phases,
      },
    });
  } catch (err) { next(err); }
};

// GET /api/v1/projects/:id/audit  — Änderungshistorie
exports.getAuditLog = async (req, res, next) => {
  try {
    const logs = await require('../models/AuditLog')
      .find({ projectId: req.params.id })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) { next(err); }
};
