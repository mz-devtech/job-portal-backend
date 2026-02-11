import cloudinary from 'cloudinary';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env' });

// Validate Cloudinary configuration
const validateCloudinaryConfig = () => {
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing Cloudinary environment variables:', missing);
    console.log('ℹ️ Please add these to your .env file:');
    console.log('CLOUDINARY_CLOUD_NAME=your_cloud_name');
    console.log('CLOUDINARY_API_KEY=your_api_key');
    console.log('CLOUDINARY_API_SECRET=your_api_secret');
    
    // For development, you can use a mock upload function
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ Running in development mode without Cloudinary');
      return false;
    }
    
    throw new Error(`Missing Cloudinary config: ${missing.join(', ')}`);
  }
  
  return true;
};

// Configure Cloudinary if credentials exist
try {
  if (validateCloudinaryConfig()) {
    cloudinary.v2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    console.log('✅ Cloudinary configured successfully');
  }
} catch (error) {
  console.error('❌ Cloudinary configuration error:', error.message);
}

// Mock upload function for development (when Cloudinary is not configured)
const mockUpload = (file, folder = 'job-portal') => {
  console.log('⚠️ [MOCK] Uploading file without Cloudinary');
  
  // Generate a mock URL for development
  const mockUrl = `https://via.placeholder.com/300/${folder === 'company-logos' ? 'corporate' : 'profile'}`;
  
  return Promise.resolve(mockUrl);
};

// Real upload function
const realUploadToCloudinary = async (file, folder = 'job-portal') => {
  try {
    console.log(`☁️ Uploading to Cloudinary folder: ${folder}`);
    
    if (!file || !file.buffer) {
      throw new Error('No file buffer provided');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        {
          folder: folder,
          resource_type: 'auto',
          transformation: [
            { width: 800, height: 800, crop: 'limit' }, // Resize for optimization
            { quality: 'auto:good' }, // Auto quality
          ],
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log(`✅ Upload successful: ${result.secure_url}`);
            resolve(result.secure_url);
          }
        }
      );

      uploadStream.end(file.buffer);
    });
  } catch (error) {
    console.error('❌ Cloudinary upload process error:', error);
    throw error;
  }
};

// Main upload function with fallback
export const uploadToCloudinary = async (file, folder = 'job-portal') => {
  // Check if Cloudinary is configured
  const isConfigured = process.env.CLOUDINARY_CLOUD_NAME && 
                      process.env.CLOUDINARY_API_KEY && 
                      process.env.CLOUDINARY_API_SECRET;
  
  if (!isConfigured) {
    console.warn('⚠️ Cloudinary not configured, using mock upload');
    return mockUpload(file, folder);
  }
  
  try {
    return await realUploadToCloudinary(file, folder);
  } catch (error) {
    console.error('❌ Cloudinary upload failed:', error.message);
    
    // Fallback to mock in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Falling back to mock upload');
      return mockUpload(file, folder);
    }
    
    throw error;
  }
};

// Delete from Cloudinary
export const deleteFromCloudinary = async (url) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.warn('⚠️ Cloudinary not configured, skipping delete');
    return { result: 'ok' };
  }

  try {
    const publicId = extractPublicId(url);
    const result = await cloudinary.v2.uploader.destroy(publicId);
    console.log(`✅ Deleted from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    console.error('❌ Cloudinary delete error:', error);
    throw error;
  }
};

// Extract public ID from Cloudinary URL
const extractPublicId = (url) => {
  if (!url) return null;
  
  try {
    // Extract public ID from Cloudinary URL
    const urlParts = url.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    
    if (uploadIndex !== -1) {
      const pathParts = urlParts.slice(uploadIndex + 2); // Skip 'upload' and version
      const publicIdWithExtension = pathParts.join('/');
      const publicId = publicIdWithExtension.split('.')[0]; // Remove extension
      return publicId;
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting public ID:', error);
    return null;
  }
};

// Test Cloudinary connection
export const testCloudinaryConnection = async () => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return { connected: false, message: 'Cloudinary not configured' };
    }
    
    // Simple test by trying to ping Cloudinary
    await cloudinary.v2.api.ping();
    return { connected: true, message: 'Cloudinary connected successfully' };
  } catch (error) {
    return { connected: false, message: `Cloudinary error: ${error.message}` };
  }
};

export default cloudinary;