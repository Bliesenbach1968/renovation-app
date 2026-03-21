'use strict';
const mongoose = require('mongoose');

const GikDataSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    unique: true,
    index: true,
  },
  grz:                   { type: Number, default: null },
  bgf:                   { type: Number, default: null },
  manualGrundstueckCost: { type: Number, default: null },
}, { timestamps: true });

module.exports = mongoose.model('GikData', GikDataSchema);
