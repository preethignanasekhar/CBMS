const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'office', 'department', 'hod', 'vice_principal', 'principal', 'auditor', 'coordinator', 'coordinater'],
    required: [true, 'Role is required']
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: function () {
      return ['department', 'hod', 'coordinator', 'coordinater'].includes(this.role);
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  permissions: {
    canApprove: { type: Boolean, default: false },
    exportReports: { type: Boolean, default: false },
    manageBudgets: { type: Boolean, default: false },
    manageUsers: { type: Boolean, default: false },
    superAdmin: { type: Boolean, default: false }
  },
  profilePicture: {
    type: String,
    default: ''
  },
  lastLogin: {
    type: Date
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;
  return user;
};

module.exports = mongoose.model('User', userSchema);
