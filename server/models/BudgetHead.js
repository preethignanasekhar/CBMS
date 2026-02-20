const mongoose = require('mongoose');

const budgetHeadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Budget head name is required'],
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: [true, 'Budget head code is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: [
      'laboratory_equipment',
      'software',
      'laboratory_furniture',
      'maintenance_spares',
      'research_development',
      'placement_training',
      'faculty_development',
      'seminar_conference',
      'valuation_curricular',
      'alumni_interaction',
      'staff_welfare',
      'printing_stationery',
      'postage_expenses',
      'refreshment_expenses',
      'functions',
      'travelling_expenses',
      'other'
    ],
    required: [true, 'Budget head category is required'],
    default: 'other'
  },
  budgetType: {
    type: String,
    enum: ['recurring', 'non-recurring'],
    required: [true, 'Budget type (recurring/non-recurring) is required'],
    default: 'recurring'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null // null means it's available to all departments
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better query performance

budgetHeadSchema.index({ category: 1 });

module.exports = mongoose.model('BudgetHead', budgetHeadSchema);
