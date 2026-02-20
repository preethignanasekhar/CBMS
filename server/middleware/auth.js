const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token or user not found.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token.' 
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired.' 
      });
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during authentication.' 
    });
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required.' 
      });
    }

    if (!roles.includes(req.user.role)) {
      console.log(`[AUTH-DENY] ${req.method} ${req.path} - User role: ${req.user.role}, Required roles: ${roles.join(', ')}`);
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Insufficient permissions.',
        userRole: req.user.role,
        requiredRoles: roles
      });
    }

    next();
  };
};

// Department access control (users can only access their own department data)
const departmentAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required.' 
    });
  }

  // Admin, office, vice_principal, principal, auditor can access all departments
  const allowedRoles = ['admin', 'office', 'vice_principal', 'principal', 'auditor'];
  
  if (allowedRoles.includes(req.user.role)) {
    return next();
  }

  // Department users and HODs can only access their own department
  if (['department', 'hod'].includes(req.user.role)) {
    const requestedDepartmentId = req.params.departmentId || req.body.department;
    
    if (requestedDepartmentId && requestedDepartmentId !== req.user.department.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. You can only access your department data.' 
      });
    }
  }

  next();
};

// Audit logging middleware
const auditLog = (eventType, targetEntity = null) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the action after response is sent
      if (req.user && res.statusCode < 400) {
        const auditData = {
          eventType,
          actor: req.user._id,
          actorRole: req.user.role,
          targetEntity,
          targetId: req.params.id || req.body._id,
          details: {
            method: req.method,
            url: req.originalUrl,
            body: req.method !== 'GET' ? req.body : undefined,
            params: req.params,
            query: req.query
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          sessionId: req.sessionID
        };

        AuditLog.create(auditData).catch(err => {
          console.error('Audit log error:', err);
        });
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

module.exports = {
  generateToken,
  verifyToken,
  authorize,
  departmentAccess,
  auditLog
};
