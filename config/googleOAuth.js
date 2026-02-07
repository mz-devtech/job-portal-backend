import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('🔑 [Google OAuth] Profile received:', profile.id);
        console.log('📧 [Google OAuth] Email:', profile.emails[0].value);
        
        // Check if user already exists
        let user = await User.findOne({ 
          $or: [
            { googleId: profile.id },
            { email: profile.emails[0].value.toLowerCase() }
          ]
        });

        if (!user) {
          // Create new user
          user = await User.create({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value.toLowerCase(),
            avatar: profile.photos[0]?.value,
            authMethod: 'google',
            isEmailVerified: true,
            isProfileComplete: true,
            username: `user_${profile.id.substring(0, 8)}_${Math.floor(Math.random() * 1000)}`,
            role: 'candidate' // Default role
          });
          console.log('✅ [Google OAuth] New user created:', user.email);
        } else if (!user.googleId) {
          // User exists with email but no Google ID - link accounts
          user.googleId = profile.id;
          user.avatar = profile.photos[0]?.value || user.avatar;
          user.authMethod = 'google';
          user.isEmailVerified = true;
          await user.save();
          console.log('✅ [Google OAuth] Linked Google account to existing user:', user.email);
        }

        return done(null, user);
      } catch (error) {
        console.error('❌ [Google OAuth] Error:', error);
        return done(error, null);
      }
    }
  )
);

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;