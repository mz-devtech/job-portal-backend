import twilio from 'twilio';
import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class NotificationService {
  constructor() {
    // Initialize Twilio client
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    // Initialize Email transporter
    this.emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  /**
   * Send SMS notification about status change
   */
  async sendStatusSMS(phoneNumber, candidateName, jobTitle, status, companyName) {
    try {
      // Format phone number (add country code if missing)
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      // Get status-specific message template
      const message = this.getStatusMessage('sms', status, {
        name: candidateName,
        jobTitle,
        company: companyName
      });

      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.twilioPhone,
        to: formattedNumber
      });

      console.log(`✅ SMS sent to ${phoneNumber}: ${result.sid}`);
      return { success: true, sid: result.sid };
    } catch (error) {
      console.error('❌ SMS sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send Email notification about status change
   */
  async sendStatusEmail(email, candidateName, jobTitle, status, companyName, note = '') {
    try {
      // Load and compile email template
      const templatePath = path.join(__dirname, '../templates/status-email.html');
      let htmlTemplate;
      
      if (fs.existsSync(templatePath)) {
        const source = fs.readFileSync(templatePath, 'utf8');
        const template = Handlebars.compile(source);
        htmlTemplate = template({
          name: candidateName,
          jobTitle,
          company: companyName,
          status: this.getStatusDisplayName(status),
          note,
          date: new Date().toLocaleDateString()
        });
      } else {
        // Fallback plain HTML
        htmlTemplate = this.getStatusMessage('email', status, {
          name: candidateName,
          jobTitle,
          company: companyName,
          note
        });
      }

      const subject = this.getEmailSubject(status, jobTitle);
      const textMessage = this.getStatusMessage('sms', status, {
        name: candidateName,
        jobTitle,
        company: companyName
      });

      const mailOptions = {
        from: `"${companyName} Hiring Team" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        text: textMessage,
        html: htmlTemplate
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      console.log(`✅ Email sent to ${email}: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send both SMS and Email notifications
   */
  async sendStatusNotifications(application, candidate, job, status, note = '') {
    const results = {
      sms: null,
      email: null
    };

    // Send SMS if candidate has phone number
    if (candidate.phone) {
      results.sms = await this.sendStatusSMS(
        candidate.phone,
        candidate.name || candidate.username,
        job.jobTitle,
        status,
        job.companyName || 'Company'
      );
    }

    // Send Email if candidate has email
    if (candidate.email) {
      results.email = await this.sendStatusEmail(
        candidate.email,
        candidate.name || candidate.username,
        job.jobTitle,
        status,
        job.companyName || 'Company',
        note
      );
    }

    return results;
  }

  /**
   * Get status-specific message templates
   */
  getStatusMessage(type, status, data) {
    const messages = {
      sms: {
        pending: `Hi ${data.name}, your application for ${data.jobTitle} at ${data.company} has been received and is pending review. We'll update you soon!`,
        reviewed: `Hi ${data.name}, good news! Your application for ${data.jobTitle} at ${data.company} has been reviewed. We'll be in touch shortly.`,
        shortlisted: `🎉 Congratulations ${data.name}! You've been shortlisted for ${data.jobTitle} at ${data.company}. Our team will contact you for next steps.`,
        interview: `📅 Hi ${data.name}, you've been invited for an interview for ${data.jobTitle} at ${data.company}. Please check your email for details.`,
        hired: `🎊 CONGRATULATIONS ${data.name}! We're pleased to offer you the position of ${data.jobTitle} at ${data.company}. Welcome to the team!`,
        rejected: `Hi ${data.name}, thank you for your interest in ${data.jobTitle} at ${data.company}. After careful review, we've decided to move forward with other candidates.`,
        withdrawn: `Hi ${data.name}, your application for ${data.jobTitle} at ${data.company} has been withdrawn as requested.`
      },
      email: {
        pending: this.getEmailTemplate('pending', data),
        reviewed: this.getEmailTemplate('reviewed', data),
        shortlisted: this.getEmailTemplate('shortlisted', data),
        interview: this.getEmailTemplate('interview', data),
        hired: this.getEmailTemplate('hired', data),
        rejected: this.getEmailTemplate('rejected', data),
        withdrawn: this.getEmailTemplate('withdrawn', data)
      }
    };

    return messages[type]?.[status] || `Your application status has been updated to ${status}`;
  }

  /**
   * Get email subject line based on status
   */
  getEmailSubject(status, jobTitle) {
    const subjects = {
      pending: `Application Received: ${jobTitle}`,
      reviewed: `Application Reviewed: ${jobTitle}`,
      shortlisted: `🎉 You've Been Shortlisted! - ${jobTitle}`,
      interview: `📅 Interview Invitation - ${jobTitle}`,
      hired: `🎊 Congratulations! Job Offer - ${jobTitle}`,
      rejected: `Update on Your Application - ${jobTitle}`,
      withdrawn: `Application Withdrawn - ${jobTitle}`
    };
    return subjects[status] || `Application Status Update: ${jobTitle}`;
  }

  /**
   * Get status display name
   */
  getStatusDisplayName(status) {
    const names = {
      pending: 'Pending Review',
      reviewed: 'Reviewed',
      shortlisted: 'Shortlisted',
      interview: 'Interview Stage',
      hired: 'Hired',
      rejected: 'Not Selected',
      withdrawn: 'Withdrawn'
    };
    return names[status] || status;
  }

  /**
   * Format phone number for Twilio
   */
  formatPhoneNumber(phone) {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Add country code if missing (assuming US/Canada)
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Get email HTML template (fallback)
   */
  getEmailTemplate(status, data) {
    const templates = {
      pending: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Application Received</h2>
          <p>Dear ${data.name},</p>
          <p>Thank you for applying for the <strong>${data.jobTitle}</strong> position at <strong>${data.company}</strong>.</p>
          <p>Your application has been received and is now pending review. Our hiring team will carefully evaluate your qualifications and get back to you soon.</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Status:</strong> <span style="color: #f59e0b;">Pending Review</span></p>
          </div>
          <p>Best regards,<br>${data.company} Hiring Team</p>
        </div>
      `,
      shortlisted: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 48px;">🎉</span>
          </div>
          <h2 style="color: #2563eb; text-align: center;">Congratulations!</h2>
          <p>Dear ${data.name},</p>
          <p>We are pleased to inform you that you have been <strong style="color: #059669;">SHORTLISTED</strong> for the <strong>${data.jobTitle}</strong> position at <strong>${data.company}</strong>!</p>
          <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <p style="margin: 0; color: #065f46;"><strong>✓ Your application stood out among many candidates</strong></p>
            <p style="margin-top: 10px; color: #065f46;">Our recruitment team will contact you within 2-3 business days to discuss next steps.</p>
          </div>
          <p>Best regards,<br>${data.company} Hiring Team</p>
        </div>
      `,
      hired: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 52px;">🎊</span>
          </div>
          <h2 style="color: #2563eb; text-align: center;">Welcome to the Team!</h2>
          <p>Dear ${data.name},</p>
          <p><strong>CONGRATULATIONS!</strong> We are thrilled to offer you the position of <strong>${data.jobTitle}</strong> at <strong>${data.company}</strong>.</p>
          <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 18px; color: #1e40af;">✨ You impressed us with your skills and experience</p>
            <p style="margin-top: 10px;">Our HR team will send you the formal offer letter and onboarding details within 24 hours.</p>
          </div>
          <p>We look forward to having you on board!</p>
          <p>Best regards,<br>${data.company} Hiring Team</p>
        </div>
      `,
      rejected: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4b5563;">Application Update</h2>
          <p>Dear ${data.name},</p>
          <p>Thank you for your interest in the <strong>${data.jobTitle}</strong> position at <strong>${data.company}</strong>.</p>
          <p>After careful consideration, we regret to inform you that we have decided to move forward with other candidates whose qualifications more closely match our current requirements.</p>
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p style="margin: 0; color: #991b1b;">This was a difficult decision, and we encourage you to apply for future positions that match your profile.</p>
          </div>
          <p>We wish you the best in your job search.</p>
          <p>Sincerely,<br>${data.company} Hiring Team</p>
        </div>
      `
    };

    return templates[status] || templates.pending;
  }
}

export default new NotificationService();