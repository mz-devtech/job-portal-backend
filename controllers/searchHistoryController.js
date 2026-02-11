import SearchHistory from '../models/SearchHistory.js';
import mongoose from 'mongoose';

// Save search query - only when user submits/search completes
export const saveSearch = async (req, res) => {
  try {
    const { searchQuery, searchType = 'keyword', filters = {} } = req.body;
    const userId = req.user?.id || null;
    
    // Validate search query
    if (!SearchHistory.isValidSearchQuery(searchQuery)) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long',
      });
    }
    
    // Get client info
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    const searchData = {
      user: userId,
      searchQuery,
      searchType,
      filters,
      ipAddress,
      userAgent,
    };
    
    const savedSearch = await SearchHistory.logSearch(searchData);
    
    res.status(201).json({
      success: true,
      message: 'Search saved successfully',
      search: savedSearch,
    });
    
  } catch (error) {
    console.error('❌ [SAVE SEARCH] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save search',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get user's recent searches (top 10)
export const getUserSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const searchHistory = await SearchHistory.find({ user: userId })
      .sort({ lastSearched: -1 })
      .limit(10) // Only top 10 most recent
      .lean();
    
    res.status(200).json({
      success: true,
      searchHistory,
    });
    
  } catch (error) {
    console.error('❌ [GET USER SEARCH HISTORY] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch search history',
    });
  }
};

// Get popular searches (global) - top 10 only
export const getPopularSearches = async (req, res) => {
  try {
    const { limit = 10, minCount = 2 } = req.query;
    
    const popularSearches = await SearchHistory.aggregate([
      {
        $group: {
          _id: '$searchQuery',
          totalSearches: { $sum: '$searchCount' },
          uniqueUsers: { $addToSet: '$user' },
          lastSearched: { $max: '$lastSearched' },
        },
      },
      {
        $addFields: {
          uniqueUserCount: { $size: '$uniqueUsers' },
        },
      },
      { $match: { totalSearches: { $gte: parseInt(minCount) } } },
      { $sort: { totalSearches: -1, lastSearched: -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          searchQuery: '$_id',
          totalSearches: 1,
          uniqueUserCount: 1,
          lastSearched: 1,
          _id: 0,
        },
      },
    ]);
    
    res.status(200).json({
      success: true,
      popularSearches,
    });
    
  } catch (error) {
    console.error('❌ [GET POPULAR SEARCHES] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch popular searches',
    });
  }
};

// Get trending searches (recent popularity) - top 10 only
export const getTrendingSearches = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Last 7 days for trending
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const trendingSearches = await SearchHistory.aggregate([
      { $match: { lastSearched: { $gte: oneWeekAgo } } },
      {
        $group: {
          _id: '$searchQuery',
          recentSearches: { $sum: '$searchCount' },
          lastSearched: { $max: '$lastSearched' },
        },
      },
      { $sort: { recentSearches: -1, lastSearched: -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          searchQuery: '$_id',
          recentSearches: 1,
          lastSearched: 1,
          _id: 0,
        },
      },
    ]);
    
    res.status(200).json({
      success: true,
      trendingSearches,
    });
    
  } catch (error) {
    console.error('❌ [GET TRENDING SEARCHES] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending searches',
    });
  }
};

// Clear user's search history
export const clearSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    await SearchHistory.deleteMany({ user: userId });
    
    res.status(200).json({
      success: true,
      message: 'Search history cleared successfully',
    });
    
  } catch (error) {
    console.error('❌ [CLEAR SEARCH HISTORY] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear search history',
    });
  }
};

// Get search suggestions
export const getSearchSuggestions = async (req, res) => {
  try {
    const { query, limit = 5 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(200).json({
        success: true,
        suggestions: [],
      });
    }
    
    const suggestions = await SearchHistory.aggregate([
      {
        $match: {
          searchQuery: { $regex: query.toLowerCase(), $options: 'i' },
          searchQuery: { $ne: query.toLowerCase() }, // Don't suggest the exact same query
        },
      },
      {
        $group: {
          _id: '$searchQuery',
          count: { $sum: '$searchCount' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          suggestion: '$_id',
          count: 1,
          _id: 0,
        },
      },
    ]);
    
    res.status(200).json({
      success: true,
      suggestions,
    });
    
  } catch (error) {
    console.error('❌ [GET SEARCH SUGGESTIONS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch search suggestions',
    });
  }
};