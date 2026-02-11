import mongoose from 'mongoose';

const searchHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    searchQuery: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 2, // Minimum 2 characters for a meaningful search
    },
    searchType: {
      type: String,
      enum: ['job', 'location', 'keyword', 'combined'],
      default: 'keyword',
    },
    filters: {
      jobType: String,
      jobCategory: String,
      experienceLevel: String,
      minSalary: Number,
      maxSalary: Number,
      isRemote: Boolean,
      country: String,
    },
    ipAddress: String,
    userAgent: String,
    searchCount: {
      type: Number,
      default: 1,
    },
    lastSearched: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
searchHistorySchema.index({ user: 1, searchQuery: 1 }, { unique: true });
searchHistorySchema.index({ searchQuery: 1 });
searchHistorySchema.index({ lastSearched: -1 });
searchHistorySchema.index({ searchCount: -1 });

// Validate if search query is a complete word (not just typing)
searchHistorySchema.statics.isValidSearchQuery = function(query) {
  if (!query || typeof query !== 'string') return false;
  
  const trimmed = query.trim();
  
  // Minimum length requirement
  if (trimmed.length < 2) return false;
  
  // Should not be just random characters (optional validation)
  // For now, just check it's a meaningful string
  return true;
};

// Log search - only for completed searches, not typing
searchHistorySchema.statics.logSearch = async function(data) {
  try {
    const { user, searchQuery, searchType, filters, ipAddress, userAgent } = data;
    
    // Validate search query
    if (!this.isValidSearchQuery(searchQuery)) {
      throw new Error('Invalid search query');
    }
    
    const cleanQuery = searchQuery.toLowerCase().trim();
    
    // Find existing search for this user and query
    const existingSearch = await this.findOne({
      user: user || null,
      searchQuery: cleanQuery,
    });
    
    if (existingSearch) {
      // Update existing search
      existingSearch.searchCount += 1;
      existingSearch.lastSearched = new Date();
      existingSearch.filters = { ...existingSearch.filters, ...filters };
      if (ipAddress) existingSearch.ipAddress = ipAddress;
      if (userAgent) existingSearch.userAgent = userAgent;
      
      await existingSearch.save();
      return existingSearch;
    } else {
      // Create new search entry
      const searchHistory = new this({
        user: user || null,
        searchQuery: cleanQuery,
        searchType,
        filters,
        ipAddress,
        userAgent,
      });
      
      await searchHistory.save();
      return searchHistory;
    }
  } catch (error) {
    console.error('Error logging search:', error);
    throw error;
  }
};

const SearchHistory = mongoose.model('SearchHistory', searchHistorySchema);

export default SearchHistory;