const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name ist Pflichtfeld'], trim: true },
    email: {
      type: String,
      required: [true, 'E-Mail ist Pflichtfeld'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Ungültige E-Mail-Adresse'],
    },
    password: { type: String, required: [true, 'Passwort ist Pflichtfeld'], minlength: 8, select: false },
    role: {
      type: String,
      enum: ['admin', 'projectLeader', 'calculator', 'worker', 'external'],
      default: 'worker',
    },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

// Passwort vor dem Speichern hashen
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Passwort vergleichen
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Kein Passwort in JSON-Ausgabe
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
