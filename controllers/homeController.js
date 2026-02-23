import Job from '../models/Job.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Category from '../models/Category.js';
import Application from '../models/Application.js';

// Get home page statistics
export const getHomeStats = async (req, res) => {
  try {
    console.log('📊 [HOME CONTROLLER] Fetching home page statistics');

    // Get total live jobs (active jobs)
    const liveJobs = await Job.countDocuments({ 
      status: 'Active', 
      expirationDate: { $gt: new Date() },
      isDeleted: { $ne: true }
    });

    // Get total companies (employers with profiles)
    const totalCompanies = await Profile.countDocuments({ role: 'employer' });

    // Get total candidates
    const totalCandidates = await User.countDocuments({ role: 'candidate' });

    // Get new jobs posted in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const newJobs = await Job.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
      isDeleted: { $ne: true }
    });

    // Format numbers with commas
    const formatNumber = (num) => {
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    res.status(200).json({
      success: true,
      stats: {
        liveJobs: formatNumber(liveJobs),
        liveJobsRaw: liveJobs,
        companies: formatNumber(totalCompanies),
        companiesRaw: totalCompanies,
        candidates: formatNumber(totalCandidates),
        candidatesRaw: totalCandidates,
        newJobs: formatNumber(newJobs),
        newJobsRaw: newJobs
      }
    });

  } catch (error) {
    console.error('❌ [HOME CONTROLLER] Get home stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get popular vacancies (job categories with counts)
export const getPopularVacancies = async (req, res) => {
  try {
    console.log('📊 [HOME CONTROLLER] Fetching popular vacancies');

    // Get all categories with job counts
    const categories = await Category.find({ isActive: true })
      .select('name slug jobCount')
      .lean();

    // If no categories in DB, provide default popular ones
    if (!categories || categories.length === 0) {
      const defaultCategories = [
        { title: "Anesthesiologists", positions: "45,904", slug: "anesthesiologists" },
        { title: "Surgeons", positions: "50,364", slug: "surgeons" },
        { title: "Obstetricians-Gynecologists", positions: "4,339", slug: "obstetricians-gynecologists" },
        { title: "Orthodontists", positions: "20,079", slug: "orthodontists" },
        { title: "Maxillofacial Surgeons", positions: "74,875", slug: "maxillofacial-surgeons" },
        { title: "Software Developer", positions: "4,359", slug: "software-developer" },
        { title: "Psychiatrists", positions: "18,599", slug: "psychiatrists" },
        { title: "Data Scientist", positions: "28,200", slug: "data-scientist" },
        { title: "Financial Manager", positions: "61,391", slug: "financial-manager" },
        { title: "Management Analysis", positions: "93,046", slug: "management-analysis" },
        { title: "IT Manager", positions: "50,963", slug: "it-manager" },
        { title: "Operations Research Analysis", positions: "16,627", slug: "operations-research-analysis" }
      ];
      
      return res.status(200).json({
        success: true,
        vacancies: defaultCategories
      });
    }

    // Get actual job counts per category
    const vacanciesWithCounts = await Promise.all(
      categories.map(async (category) => {
        // Get count of active jobs in this category
        const jobCount = await Job.countDocuments({
          jobCategory: category.name,
          status: 'Active',
          expirationDate: { $gt: new Date() },
          isDeleted: { $ne: true }
        });

        // Format the count
        const formattedCount = jobCount.toLocaleString();

        return {
          title: category.name,
          positions: `${formattedCount} Open Positions`,
          slug: category.slug,
          rawCount: jobCount
        };
      })
    );

    // Sort by job count (most popular first)
    vacanciesWithCounts.sort((a, b) => b.rawCount - a.rawCount);

    // Take top 12
    const topVacancies = vacanciesWithCounts.slice(0, 12);

    res.status(200).json({
      success: true,
      vacancies: topVacancies
    });

  } catch (error) {
    console.error('❌ [HOME CONTROLLER] Get popular vacancies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch popular vacancies',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get featured jobs
export const getFeaturedJobs = async (req, res) => {
  try {
    console.log('📊 [HOME CONTROLLER] Fetching featured jobs');

    const { limit = 12 } = req.query;

    // Get featured jobs (isFeatured: true) or most recent active jobs
    const jobs = await Job.find({
      status: 'Active',
      expirationDate: { $gt: new Date() },
      isDeleted: { $ne: true }
    })
      .sort({ isFeatured: -1, createdAt: -1 }) // Featured first, then newest
      .limit(parseInt(limit))
      .populate('employer', 'name companyName avatar')
      .select('jobTitle jobType salaryRange location employer isFeatured createdAt')
      .lean();

    // Format jobs for frontend
    const formattedJobs = jobs.map(job => {
      // Determine job type format
      let jobType = job.jobType?.toUpperCase().replace('-', '_') || 'FULL_TIME';
      
      // Format salary
      let salaryText = 'Salary not specified';
      if (job.salaryRange) {
        const { min, max, currency, isNegotiable } = job.salaryRange;
        if (min && max) {
          salaryText = `$${min.toLocaleString()} - $${max.toLocaleString()}`;
        } else if (min) {
          salaryText = `From $${min.toLocaleString()}`;
        } else if (max) {
          salaryText = `Up to $${max.toLocaleString()}`;
        } else if (isNegotiable) {
          salaryText = 'Negotiable';
        }
      }

      // Get company name
      const companyName = job.employer?.companyName || job.employer?.name || 'Unknown Company';
      
      // Get location
      const location = job.location ? 
        `${job.location.city || ''}, ${job.location.country || ''}`.replace(/^, |, $/g, '') : 
        'Location not specified';

      // Company logo (placeholder if not available)
      const logo = job.employer?.avatar || '/google.png';

      return {
        id: job._id,
        title: job.jobTitle,
        type: jobType,
        salary: salaryText,
        company: companyName,
        location: location,
        logo: logo,
        isFeatured: job.isFeatured || false
      };
    });

    res.status(200).json({
      success: true,
      jobs: formattedJobs
    });

  } catch (error) {
    console.error('❌ [HOME CONTROLLER] Get featured jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured jobs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get top companies
export const getTopCompanies = async (req, res) => {
  try {
    console.log('📊 [HOME CONTROLLER] Fetching top companies');

    const { limit = 6 } = req.query;

    // Get employers with most jobs and complete profiles
    const companies = await Profile.find({ 
      role: 'employer',
      isProfileComplete: true 
    })
      .populate({
        path: 'user',
        select: 'name email avatar'
      })
      .limit(parseInt(limit))
      .lean();

    // Get job counts and featured status for each company
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        const userId = company.user?._id;
        
        if (!userId) return null;

        // Count active jobs for this company
        const activeJobsCount = await Job.countDocuments({
          employer: userId,
          status: 'Active',
          expirationDate: { $gt: new Date() },
          isDeleted: { $ne: true }
        });

        // Check if company has featured jobs
        const hasFeaturedJobs = await Job.exists({
          employer: userId,
          isFeatured: true,
          status: 'Active'
        });

        // Get company name
        const companyName = company.companyInfo?.companyName || company.user?.name || 'Unknown Company';
        
        // Get location
        const location = company.location || 'Location not specified';
        
        // Get logo/color (generate a consistent color based on company name)
        const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-pink-500', 'bg-orange-500', 'bg-teal-500'];
        const colorIndex = (companyName.length + (company._id?.toString().charCodeAt(0) || 0)) % colors.length;
        const bgColor = colors[colorIndex];

        return {
          id: company._id,
          userId: userId,
          name: companyName,
          location: location,
          positions: activeJobsCount,
          featured: hasFeaturedJobs || activeJobsCount > 5, // Mark as featured if has featured jobs or more than 5 active jobs
          logo: company.companyInfo?.logo || company.user?.avatar || null,
          bgColor: bgColor,
          icon: companyName.charAt(0).toUpperCase() // First letter for placeholder
        };
      })
    );

    // Filter out null values and sort by number of positions (highest first)
    const validCompanies = companiesWithStats
      .filter(c => c !== null)
      .sort((a, b) => b.positions - a.positions);

    // If we don't have enough companies, add some placeholder featured companies
    if (validCompanies.length < parseInt(limit)) {
      const placeholderCompanies = [
        { name: "Dribbble", location: "Dhaka, Bangladesh", positions: 3, featured: true, bgColor: "bg-pink-500", icon: "D" },
        { name: "Google", location: "Mountain View, CA", positions: 12, featured: true, bgColor: "bg-blue-500", icon: "G" },
        { name: "Microsoft", location: "Redmond, WA", positions: 8, featured: true, bgColor: "bg-green-500", icon: "M" },
        { name: "Amazon", location: "Seattle, WA", positions: 15, featured: true, bgColor: "bg-orange-500", icon: "A" },
        { name: "Meta", location: "Menlo Park, CA", positions: 6, featured: true, bgColor: "bg-purple-500", icon: "M" },
        { name: "Apple", location: "Cupertino, CA", positions: 9, featured: true, bgColor: "bg-teal-500", icon: "A" }
      ];

      // Add placeholders until we reach the limit
      while (validCompanies.length < parseInt(limit)) {
        const placeholder = placeholderCompanies[validCompanies.length % placeholderCompanies.length];
        validCompanies.push({
          id: `placeholder-${validCompanies.length}`,
          name: placeholder.name,
          location: placeholder.location,
          positions: placeholder.positions,
          featured: placeholder.featured,
          bgColor: placeholder.bgColor,
          icon: placeholder.icon,
          isPlaceholder: true
        });
      }
    }

    res.status(200).json({
      success: true,
      companies: validCompanies.slice(0, parseInt(limit))
    });

  } catch (error) {
    console.error('❌ [HOME CONTROLLER] Get top companies error:', error);
    
    // Return default companies on error
    const defaultCompanies = [
      { name: "Dribbble", location: "Dhaka, Bangladesh", positions: 3, featured: true, bgColor: "bg-pink-500", icon: "D" },
      { name: "Google", location: "Mountain View, CA", positions: 12, featured: true, bgColor: "bg-blue-500", icon: "G" },
      { name: "Microsoft", location: "Redmond, WA", positions: 8, featured: true, bgColor: "bg-green-500", icon: "M" },
      { name: "Amazon", location: "Seattle, WA", positions: 15, featured: true, bgColor: "bg-orange-500", icon: "A" },
      { name: "Meta", location: "Menlo Park, CA", positions: 6, featured: true, bgColor: "bg-purple-500", icon: "M" },
      { name: "Apple", location: "Cupertino, CA", positions: 9, featured: true, bgColor: "bg-teal-500", icon: "A" }
    ];

    res.status(200).json({
      success: true,
      companies: defaultCompanies,
      fromCache: true
    });
  }
};

// Search jobs from home page
export const searchJobs = async (req, res) => {
  try {
    const { keyword, location } = req.query;

    const query = {
      status: 'Active',
      expirationDate: { $gt: new Date() },
      isDeleted: { $ne: true }
    };

    if (keyword) {
      query.$or = [
        { jobTitle: { $regex: keyword, $options: 'i' } },
        { jobDescription: { $regex: keyword, $options: 'i' } },
        { tags: { $in: [new RegExp(keyword, 'i')] } }
      ];
    }

    if (location) {
      query.$or = [
        { 'location.city': { $regex: location, $options: 'i' } },
        { 'location.country': { $regex: location, $options: 'i' } },
        { 'location.state': { $regex: location, $options: 'i' } }
      ];
    }

    const jobs = await Job.find(query)
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(10)
      .populate('employer', 'name companyName')
      .select('jobTitle jobType salaryRange location slug')
      .lean();

    res.status(200).json({
      success: true,
      jobs,
      count: jobs.length
    });

  } catch (error) {
    console.error('❌ [HOME CONTROLLER] Search jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search jobs'
    });
  }
};