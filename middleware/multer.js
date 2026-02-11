import multer from 'multer';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter for employer files
const employerFileFilter = (req, file, cb) => {
  // Accept images and PDFs
  if (
    file.mimetype.startsWith('image/') ||
    file.mimetype === 'application/pdf'
  ) {
    cb(null, true);
  } else {
    cb(new Error('Only images and PDF files are allowed'), false);
  }
};

// File filter for candidate files
const candidateFileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedPDFTypes = /pdf/;
  
  // Check for profile image
  if (file.fieldname === 'profileImage') {
    if (allowedImageTypes.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for profile picture'), false);
    }
  }
  // Check for CV
  else if (file.fieldname === 'cv') {
    if (allowedPDFTypes.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for CV'), false);
    }
  }
  // Allow other files
  else {
    cb(null, true);
  }
};

// Configure multer for employer files
const upload = multer({
  storage: storage,
  fileFilter: employerFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Configure multer for candidate files
const candidateUpload = multer({
  storage: storage,
  fileFilter: candidateFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Middleware for employer profile uploads
export const uploadEmployerFiles = upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
]);

// Middleware for single profile image upload (for user profile picture)
export const uploadProfileImage = upload.single('profileImage');

// Middleware for candidate profile uploads
export const uploadCandidateFiles = candidateUpload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'cv', maxCount: 1 },
]);

export default upload;