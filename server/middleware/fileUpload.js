const multer = require('multer');
const path = require('path');
const fs = require('fs');
const NodeClam = require('clamscan');

// Initialize ClamAV Scanner
let clamScan = null;
try {
  new NodeClam().init({
    remove_infected: true, // Removes infected files from disk
    quarantine_infected: false,
    debug_mode: process.env.NODE_ENV === 'development',
    scan_recursively: false,
    clamdscan: {
      host: process.env.CLAMAV_HOST || 'localhost',
      port: process.env.CLAMAV_PORT || 3310,
      timeout: 60000,
      local_fallback: false,
      bypass_test: true, // Don't check for binary if using TCP
      active: true
    },
    preference: 'clamdscan'
  }).then(scanner => {
    clamScan = scanner;
    console.log(`✅ ClamAV Scanner initialized at ${process.env.CLAMAV_HOST || 'localhost'}:${process.env.CLAMAV_PORT || 3310}`);
  }).catch(err => {
    console.warn('⚠️ ClamAV Initialization failed (Virus scanning disabled):', err.message);
  });
} catch (err) {
  console.warn('⚠️ ClamAV Setup Error:', err.message);
}

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create department-specific folder
    const departmentId = String(req.body.departmentId || req.user?.department || 'general');
    const deptDir = path.join(uploadDir, departmentId);

    if (!fs.existsSync(deptDir)) {
      fs.mkdirSync(deptDir, { recursive: true });
    }

    cb(null, deptDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

// File filter for allowed file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only PDF, JPG, and PNG files are allowed!'));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  },
  fileFilter: fileFilter
});

// Middleware for handling file uploads
const uploadMiddleware = upload.array('attachments', 5);

// Enhanced file upload middleware with error handling and virus scanning
const handleFileUpload = (req, res, next) => {
  uploadMiddleware(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size is 10MB per file.'
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Too many files. Maximum 5 files allowed.'
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Unexpected field name for file upload.'
        });
      }
    }

    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    // Process uploaded files and scan for viruses
    if (req.files && req.files.length > 0) {
      const filesToProcess = req.files;
      const scanResults = {
        scanned: 0,
        infected: 0,
        clean: 0,
        skipped: 0,
        details: []
      };

      // Perform Virus Scan if Scanner is active
      if (clamScan) {
        try {
          for (const file of filesToProcess) {
            const result = await clamScan.is_infected(file.path);
            const { is_infected, viruses } = result;

            if (is_infected) {
              console.warn(`🚨 Virus detected in ${file.originalname}: ${viruses.join(', ')}`);
              scanResults.infected++;
              scanResults.details.push({ file: file.originalname, status: 'infected', viruses });

              // Delete the infected file immediately
              if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
              }
            } else {
              scanResults.clean++;
              scanResults.scanned++;
            }
          }
        } catch (scanErr) {
          console.error('Virus scan error:', scanErr);
          scanResults.skipped = filesToProcess.length - scanResults.scanned;
        }
      } else {
        scanResults.skipped = filesToProcess.length;
      }

      req.virusScanResults = scanResults;

      // If any files were infected, fail the whole request and cleanup proper files if necessary
      if (scanResults.infected > 0) {
        // Cleanup other files from this batch to avoid partial uploads on error
        filesToProcess.forEach(file => {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });

        return res.status(400).json({
          success: false,
          message: 'Upload rejected: Virus detected in one or more files.',
          scanResults
        });
      }

      req.uploadedFiles = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
        url: `/uploads/${String(req.body.departmentId || req.user?.department || 'general')}/${file.filename}`
      }));
    }

    next();
  });
};

// File serving middleware
const serveFiles = (req, res, next) => {
  const filePath = path.join(uploadDir, req.params.departmentId, req.params.filename);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: 'File not found'
    });
  }

  // Set appropriate headers
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png'
  };

  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);

  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
};

// File deletion utility
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
  return false;
};

// Clean up old files utility
const cleanupOldFiles = (olderThanDays = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const cleanupDirectory = (dir) => {
    try {
      const files = fs.readdirSync(dir);

      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
          cleanupDirectory(filePath);
          // Remove empty directories
          try {
            fs.rmdirSync(filePath);
          } catch (err) {
            // Directory not empty, ignore
          }
        } else if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          console.log(`Deleted old file: ${filePath}`);
        }
      });
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  cleanupDirectory(uploadDir);
};

const profilePictureUpload = upload.single('profilePicture');

const handleProfilePictureUpload = (req, res, next) => {
  console.log('  [MULTER-TRACE] Entering handleProfilePictureUpload');

  profilePictureUpload(req, res, async (err) => {
    console.log('  [MULTER-TRACE] Multer callback triggered');

    if (err instanceof multer.MulterError) {
      console.error('  [MULTER-ERROR]', err.code, err.message);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File size too large. Max 10MB allowed.' });
      }
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      console.error('  [NON-MULTER-ERROR]', err.message);
      return res.status(400).json({ success: false, message: err.message });
    }

    if (!req.file) {
      console.warn('  [MULTER-WARN] No file found in request. Body:', JSON.stringify(req.body));
      return next();
    }

    try {
      console.log(`  [MULTER] Received file: ${req.file.originalname} (${req.file.size} bytes)`);
      console.log(`  [MULTER] Path: ${req.file.path}`);

      // Virus scan if scanner is active
      if (clamScan) {
        console.log('  [CLAMAV] Performing scan...');
        const result = await clamScan.is_infected(req.file.path);
        if (result.is_infected) {
          console.warn(`  [CLAMAV] Infected file detected: ${result.viruses.join(', ')}`);
          fs.unlinkSync(req.file.path);
          return res.status(400).json({
            success: false,
            message: `Virus detected and file removed: ${result.viruses.join(', ')}`
          });
        }
        console.log('  [CLAMAV] Scan clean.');
      }

      let deptId = req.body.departmentId || req.user?.department || 'general';
      if (deptId && typeof deptId === 'object' && deptId._id) {
        deptId = String(deptId._id);
      } else {
        deptId = String(deptId);
      }
      console.log(`  [MULTER] Department ID resolved as: ${deptId}`);

      req.uploadedFile = {
        filename: req.file.filename,
        path: req.file.path,
        url: `/uploads/${deptId}/${req.file.filename}`
      };
      console.log(`  [MULTER] Upload processed. URL: ${req.uploadedFile.url}`);
      next();
    } catch (error) {
      console.error('  [MULTER] processing error:', error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ success: false, message: 'Error processing uploaded image' });
    }
  });
};

module.exports = {
  handleFileUpload,
  handleProfilePictureUpload,
  serveFiles,
  deleteFile,
  cleanupOldFiles,
  uploadDir
};