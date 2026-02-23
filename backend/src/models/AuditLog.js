const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    entityType: { type: String, enum: ['project', 'floor', 'room', 'position', 'container', 'user', 'template'] },
    entityId:   mongoose.Schema.Types.ObjectId,
    action:     { type: String, enum: ['create', 'update', 'delete'], required: true },
    changes: {
      before: mongoose.Schema.Types.Mixed,
      after:  mongoose.Schema.Types.Mixed,
    },
    description: String, // z.B. "Position 'Estrich entfernen' wurde aktualisiert"
    ip:        String,
    userAgent: String,
  },
  { timestamps: true }
);

auditLogSchema.index({ projectId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
