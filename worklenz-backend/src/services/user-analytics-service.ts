import db from "../config/db";
import { log_error } from "../shared/utils";
import {
  UsageMetrics,
  FeatureUtilization,
  GrowthTrend,
  PeakUsage,
  UserType
} from "../interfaces/plan-recommendation";

export class UserAnalyticsService {
  
  /**
   * Analyze comprehensive usage patterns for an organization
   */
  public static async analyzeUsagePatterns(organizationId: string): Promise<UsageMetrics> {
    try {
      const [
        basicMetrics,
        featureUtilization,
        growthTrend,
        peakUsagePeriods
      ] = await Promise.all([
        this.getBasicUsageMetrics(organizationId),
        this.analyzeFeatureUtilization(organizationId),
        this.calculateGrowthTrends(organizationId),
        this.identifyPeakUsagePeriods(organizationId)
      ]);

      const [collaborationIndex, projectComplexity] = await Promise.all([
        this.calculateTeamCollaborationIndex(organizationId),
        this.calculateAverageProjectComplexity(organizationId)
      ]);

      return {
        totalUsers: basicMetrics.totalUsers || 0,
        activeUsers: basicMetrics.activeUsers || 0,
        totalProjects: basicMetrics.totalProjects || 0,
        activeProjects: basicMetrics.activeProjects || 0,
        storageUsed: basicMetrics.storageUsed || 0,
        averageProjectComplexity: projectComplexity,
        teamCollaborationIndex: collaborationIndex,
        featureUtilization,
        growthTrend,
        peakUsagePeriods
      };
    } catch (error) {
      log_error(error);
      throw new Error("Failed to analyze usage patterns");
    }
  }

  /**
   * Get basic usage metrics (users, projects, storage)
   */
  private static async getBasicUsageMetrics(organizationId: string): Promise<Partial<UsageMetrics>> {
    const query = `
      WITH org_teams AS (
        SELECT t.id as team_id
        FROM organizations o
        JOIN teams t ON t.user_id = o.user_id
        WHERE o.id = $1
      ),
      user_metrics AS (
        SELECT 
          COUNT(DISTINCT tm.email) as total_users,
          COUNT(DISTINCT CASE WHEN tm.active = true THEN tm.email END) as active_users
        FROM org_teams ot
        LEFT JOIN team_members tm ON tm.team_id = ot.team_id
      ),
      project_metrics AS (
        SELECT 
          COUNT(DISTINCT p.id) as total_projects,
          COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_projects
        FROM org_teams ot
        LEFT JOIN projects p ON p.team_id = ot.team_id
      ),
      storage_metrics AS (
        SELECT 
          COALESCE(SUM(ta.size), 0) as storage_used
        FROM org_teams ot
        LEFT JOIN task_attachments ta ON ta.team_id = ot.team_id
      )
      SELECT 
        um.total_users,
        um.active_users,
        pm.total_projects,
        pm.active_projects,
        sm.storage_used
      FROM user_metrics um
      CROSS JOIN project_metrics pm
      CROSS JOIN storage_metrics sm
    `;

    const result = await db.query(query, [organizationId]);
    const data = result.rows[0];

    return {
      totalUsers: Number(data?.total_users) || 0,
      activeUsers: Number(data?.active_users) || 0,
      totalProjects: Number(data?.total_projects) || 0,
      activeProjects: Number(data?.active_projects) || 0,
      storageUsed: Number(data?.storage_used) || 0
    };
  }

  /**
   * Analyze feature utilization patterns
   */
  private static async analyzeFeatureUtilization(organizationId: string): Promise<FeatureUtilization> {
    const query = `
      WITH org_teams AS (
        SELECT t.id as team_id
        FROM organizations o
        JOIN teams t ON t.user_id = o.user_id
        WHERE o.id = $1
      ),
      project_counts AS (
        SELECT COUNT(DISTINCT p.id) as total_projects
        FROM org_teams ot
        LEFT JOIN projects p ON p.team_id = ot.team_id
      ),
      task_counts AS (
        SELECT COUNT(DISTINCT tasks.id) as total_tasks
        FROM org_teams ot
        LEFT JOIN projects p ON p.team_id = ot.team_id
        LEFT JOIN tasks ON tasks.project_id = p.id
      ),
      feature_usage AS (
        SELECT 
          -- Gantt Charts Usage
          COUNT(DISTINCT CASE WHEN p.gantt_enabled = true THEN p.id END)::float / NULLIF(pc.total_projects, 0) as gantt_usage,
          
          -- Time Tracking Usage (tasks with time logs in last 30 days)
          COUNT(DISTINCT CASE WHEN tl.created_at > NOW() - INTERVAL '30 days' THEN tl.task_id END)::float / NULLIF(tc.total_tasks, 0) as time_tracking_usage,
          
          -- Custom Fields Usage
          COUNT(DISTINCT cf.id)::float / NULLIF(pc.total_projects, 0) as custom_fields_per_project,
          
          -- Advanced Reporting (report exports in last 30 days)
          COUNT(DISTINCT CASE WHEN ale.created_at > NOW() - INTERVAL '30 days' AND ale.action_name LIKE '%export%' THEN ale.id END) > 0 as has_reporting_usage,
          
          -- Client Portal Usage (projects with client access)
          COUNT(DISTINCT CASE WHEN p.client_id IS NOT NULL THEN p.id END)::float / NULLIF(pc.total_projects, 0) as client_portal_usage,
          
          -- Resource Management (workload/allocation views)
          COUNT(DISTINCT CASE WHEN ale.action_name LIKE '%workload%' OR ale.action_name LIKE '%allocation%' THEN ale.user_id END) > 0 as has_resource_mgmt_usage
          
        FROM org_teams ot
        LEFT JOIN projects p ON p.team_id = ot.team_id
        LEFT JOIN tasks ON tasks.project_id = p.id
        LEFT JOIN task_work_log tl ON tl.task_id = tasks.id
        LEFT JOIN custom_fields cf ON cf.project_id = p.id
        LEFT JOIN activity_logs ale ON ale.team_id = ot.team_id
        CROSS JOIN project_counts pc
        CROSS JOIN task_counts tc
      )
      SELECT 
        COALESCE(gantt_usage, 0) as gantt_usage,
        COALESCE(time_tracking_usage, 0) as time_tracking_usage,
        LEAST(COALESCE(custom_fields_per_project, 0), 1.0) as custom_fields_usage,
        CASE WHEN has_reporting_usage THEN 0.8 ELSE 0.2 END as reporting_usage,
        COALESCE(client_portal_usage, 0) as client_portal_usage,
        CASE WHEN has_resource_mgmt_usage THEN 0.7 ELSE 0.1 END as resource_mgmt_usage
      FROM feature_usage
    `;

    const result = await db.query(query, [organizationId]);
    const data = result.rows[0] || {};

    return {
      ganttCharts: Number(data.gantt_usage) || 0,
      timeTracking: Number(data.time_tracking_usage) || 0,
      customFields: Number(data.custom_fields_usage) || 0,
      reporting: Number(data.reporting_usage) || 0.2,
      integrations: 0.2, // Default - would need integration usage tracking
      advancedPermissions: 0.3, // Default - would need permission usage tracking
      clientPortal: Number(data.client_portal_usage) || 0,
      resourceManagement: Number(data.resource_mgmt_usage) || 0.1
    };
  }

  /**
   * Calculate growth trends and predictions
   */
  private static async calculateGrowthTrends(organizationId: string): Promise<GrowthTrend> {
    const query = `
      WITH org_teams AS (
        SELECT t.id as team_id, t.created_at as team_created
        FROM organizations o
        JOIN teams t ON t.user_id = o.user_id
        WHERE o.id = $1
      ),
      monthly_user_growth AS (
        SELECT 
          DATE_TRUNC('month', tm.created_at) as month,
          COUNT(DISTINCT tm.email) as new_users_month
        FROM org_teams ot
        JOIN team_members tm ON tm.team_id = ot.team_id
        WHERE tm.created_at > NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', tm.created_at)
        ORDER BY month
      ),
      monthly_project_growth AS (
        SELECT 
          DATE_TRUNC('month', p.created_at) as month,
          COUNT(DISTINCT p.id) as new_projects_month
        FROM org_teams ot
        JOIN projects p ON p.team_id = ot.team_id
        WHERE p.created_at > NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', p.created_at)
        ORDER BY month
      ),
      current_totals AS (
        SELECT 
          COUNT(DISTINCT tm.email) as current_users,
          COUNT(DISTINCT p.id) as current_projects
        FROM org_teams ot
        LEFT JOIN team_members tm ON tm.team_id = ot.team_id
        LEFT JOIN projects p ON p.team_id = ot.team_id
      )
      SELECT 
        ct.current_users,
        ct.current_projects,
        COALESCE(AVG(mug.new_users_month), 0) as avg_monthly_user_growth,
        COALESCE(AVG(mpg.new_projects_month), 0) as avg_monthly_project_growth,
        ot.team_created
      FROM current_totals ct
      CROSS JOIN org_teams ot
      LEFT JOIN monthly_user_growth mug ON true
      LEFT JOIN monthly_project_growth mpg ON true
      GROUP BY ct.current_users, ct.current_projects, ot.team_created
    `;

    const result = await db.query(query, [organizationId]);
    const data = result.rows[0] || {};

    const currentUsers = Number(data.current_users) || 1;
    const currentProjects = Number(data.current_projects) || 0;
    const avgMonthlyUserGrowth = Number(data.avg_monthly_user_growth) || 0;
    const avgMonthlyProjectGrowth = Number(data.avg_monthly_project_growth) || 0;

    // Calculate growth rates
    const userGrowthRate = currentUsers > 0 ? Math.min(avgMonthlyUserGrowth / currentUsers, 0.5) : 0.1;
    const projectGrowthRate = currentProjects > 0 ? Math.min(avgMonthlyProjectGrowth / currentProjects, 0.5) : 0.15;
    const storageGrowthRate = 0.2; // Default estimate

    // Calculate predictions based on growth rates
    const predicted3MonthUsers = Math.ceil(currentUsers * Math.pow(1 + userGrowthRate, 3));
    const predicted6MonthUsers = Math.ceil(currentUsers * Math.pow(1 + userGrowthRate, 6));
    const predicted12MonthUsers = Math.ceil(currentUsers * Math.pow(1 + userGrowthRate, 12));

    return {
      userGrowthRate: userGrowthRate,
      projectGrowthRate: projectGrowthRate,
      storageGrowthRate: storageGrowthRate,
      predicted3MonthUsers: predicted3MonthUsers,
      predicted6MonthUsers: predicted6MonthUsers,
      predicted12MonthUsers: predicted12MonthUsers
    };
  }

  /**
   * Identify peak usage periods
   */
  private static async identifyPeakUsagePeriods(organizationId: string): Promise<PeakUsage[]> {
    const query = `
      WITH org_teams AS (
        SELECT t.id as team_id
        FROM organizations o
        JOIN teams t ON t.user_id = o.user_id
        WHERE o.id = $1
      ),
      daily_activity AS (
        SELECT 
          DATE(ale.created_at) as activity_date,
          COUNT(DISTINCT ale.user_id) as active_users,
          COUNT(DISTINCT CASE WHEN ale.action_name LIKE '%project%' THEN ale.project_id END) as active_projects,
          COUNT(*) as total_actions
        FROM org_teams ot
        JOIN activity_logs ale ON ale.team_id = ot.team_id
        WHERE ale.created_at > NOW() - INTERVAL '90 days'
        GROUP BY DATE(ale.created_at)
      ),
      peak_detection AS (
        SELECT 
          activity_date,
          active_users,
          active_projects,
          total_actions,
          AVG(active_users) OVER (ORDER BY activity_date ROWS BETWEEN 7 PRECEDING AND 7 FOLLOWING) as avg_users_window,
          AVG(total_actions) OVER (ORDER BY activity_date ROWS BETWEEN 7 PRECEDING AND 7 FOLLOWING) as avg_actions_window
        FROM daily_activity
      )
      SELECT 
        activity_date,
        active_users,
        active_projects,
        total_actions,
        'High activity period' as reason
      FROM peak_detection
      WHERE active_users > avg_users_window * 1.3 
         OR total_actions > avg_actions_window * 1.5
      ORDER BY activity_date DESC
      LIMIT 10
    `;

    const result = await db.query(query, [organizationId]);
    
    return result.rows.map(row => ({
      date: new Date(row.activity_date),
      userCount: Number(row.active_users),
      projectCount: Number(row.active_projects),
      reason: row.reason
    }));
  }

  /**
   * Calculate team collaboration index
   */
  private static async calculateTeamCollaborationIndex(organizationId: string): Promise<number> {
    const query = `
      WITH org_teams AS (
        SELECT t.id as team_id
        FROM organizations o
        JOIN teams t ON t.user_id = o.user_id
        WHERE o.id = $1
      ),
      collaboration_metrics AS (
        SELECT 
          COUNT(DISTINCT tm.email) as total_members,
          COUNT(DISTINCT tasks.id) as total_tasks,
          COUNT(DISTINCT CASE WHEN tasks.assigned_to IS NOT NULL THEN tasks.id END) as assigned_tasks,
          COUNT(DISTINCT tc.id) as total_comments,
          COUNT(DISTINCT ta.id) as total_attachments,
          COUNT(DISTINCT tl.id) as total_time_logs,
          COUNT(DISTINCT p.id) as total_projects,
          COUNT(DISTINCT CASE WHEN array_length(p.project_members, 1) > 1 THEN p.id END) as collaborative_projects
        FROM org_teams ot
        LEFT JOIN team_members tm ON tm.team_id = ot.team_id AND tm.active = true
        LEFT JOIN projects p ON p.team_id = ot.team_id
        LEFT JOIN tasks ON tasks.project_id = p.id
        LEFT JOIN task_comments tc ON tc.task_id = tasks.id
        LEFT JOIN task_attachments ta ON ta.task_id = tasks.id
        LEFT JOIN task_work_log tl ON tl.task_id = tasks.id
      )
      SELECT 
        total_members,
        total_tasks,
        assigned_tasks,
        total_comments,
        total_attachments,
        total_time_logs,
        total_projects,
        collaborative_projects,
        CASE 
          WHEN total_tasks = 0 THEN 0.3
          ELSE (
            (assigned_tasks::float / total_tasks * 0.3) +
            (LEAST(total_comments::float / total_tasks, 2.0) * 0.25) +
            (LEAST(total_attachments::float / total_tasks, 1.0) * 0.2) +
            (CASE WHEN total_projects > 0 THEN collaborative_projects::float / total_projects ELSE 0 END * 0.25)
          )
        END as collaboration_index
      FROM collaboration_metrics
    `;

    const result = await db.query(query, [organizationId]);
    const data = result.rows[0];
    
    return Math.min(1.0, Number(data?.collaboration_index) || 0.3);
  }

  /**
   * Calculate average project complexity
   */
  private static async calculateAverageProjectComplexity(organizationId: string): Promise<number> {
    const query = `
      WITH org_teams AS (
        SELECT t.id as team_id
        FROM organizations o
        JOIN teams t ON t.user_id = o.user_id
        WHERE o.id = $1
      ),
      project_complexity AS (
        SELECT 
          p.id as project_id,
          COUNT(DISTINCT tasks.id) as task_count,
          COUNT(DISTINCT tp.id) as phase_count,
          COUNT(DISTINCT cf.id) as custom_field_count,
          COUNT(DISTINCT td.id) as dependency_count,
          array_length(p.project_members, 1) as member_count,
          CASE 
            WHEN COUNT(DISTINCT tasks.id) = 0 THEN 0.2
            ELSE (
              (LEAST(COUNT(DISTINCT tasks.id)::float / 50, 1.0) * 0.3) +
              (LEAST(COUNT(DISTINCT tp.id)::float / 10, 1.0) * 0.2) +
              (LEAST(COUNT(DISTINCT cf.id)::float / 20, 1.0) * 0.2) +
              (LEAST(COUNT(DISTINCT td.id)::float / 20, 1.0) * 0.15) +
              (LEAST(COALESCE(array_length(p.project_members, 1), 1)::float / 20, 1.0) * 0.15)
            )
          END as complexity_score
        FROM org_teams ot
        JOIN projects p ON p.team_id = ot.team_id
        LEFT JOIN tasks ON tasks.project_id = p.id
        LEFT JOIN task_phases tp ON tp.project_id = p.id
        LEFT JOIN custom_fields cf ON cf.project_id = p.id
        LEFT JOIN task_dependencies td ON td.task_id = tasks.id
        GROUP BY p.id, p.project_members
      )
      SELECT 
        COUNT(*) as project_count,
        AVG(complexity_score) as avg_complexity
      FROM project_complexity
    `;

    const result = await db.query(query, [organizationId]);
    const data = result.rows[0];
    
    return Math.min(1.0, Number(data?.avg_complexity) || 0.4);
  }

  /**
   * Analyze user type progression and behavior patterns
   */
  public static async analyzeUserTypeProgression(organizationId: string): Promise<{
    currentUserType: UserType;
    daysInCurrentType: number;
    progressionLikelihood: number;
    nextLikelyUserType?: UserType;
    behaviorPatterns: string[];
  }> {
    const query = `
      WITH org_details AS (
        SELECT 
          o.user_type,
          o.trial_expire_date,
          o.created_at as org_created,
          lus.subscription_status,
          lus.created_at as subscription_created,
          EXISTS(SELECT 1 FROM licensing_custom_subs WHERE user_id = o.user_id) as has_custom,
          EXISTS(SELECT 1 FROM licensing_coupon_codes WHERE redeemed_by = o.user_id AND code LIKE '%APPSUMO%') as is_appsumo
        FROM organizations o
        LEFT JOIN licensing_user_subscriptions lus ON lus.user_id = o.user_id
        WHERE o.id = $1
      ),
      usage_intensity AS (
        SELECT 
          COUNT(DISTINCT DATE(ale.created_at)) as active_days_last_30,
          COUNT(*) as total_actions_last_30,
          COUNT(DISTINCT ale.user_id) as unique_active_users
        FROM organizations o
        JOIN teams t ON t.user_id = o.user_id
        LEFT JOIN activity_logs ale ON ale.team_id = t.id AND ale.created_at > NOW() - INTERVAL '30 days'
        WHERE o.id = $1
      )
      SELECT 
        od.*,
        ui.active_days_last_30,
        ui.total_actions_last_30,
        ui.unique_active_users,
        EXTRACT(DAY FROM NOW() - COALESCE(od.subscription_created, od.org_created))::int as days_in_current_state
      FROM org_details od
      CROSS JOIN usage_intensity ui
    `;

    const result = await db.query(query, [organizationId]);
    const data = result.rows[0];

    // Determine current user type
    let currentUserType: UserType;
    if (data.is_appsumo) currentUserType = UserType.APPSUMO;
    else if (data.has_custom) currentUserType = UserType.CUSTOM_PLAN;
    else if (data.trial_expire_date && new Date(data.trial_expire_date) > new Date()) currentUserType = UserType.TRIAL;
    else if (data.subscription_status === 'active') currentUserType = UserType.ACTIVE_SUBSCRIBER;
    else currentUserType = UserType.FREE;

    // Calculate progression likelihood based on usage patterns
    const usageScore = this.calculateUsageScore(data);
    const progressionLikelihood = this.calculateProgressionLikelihood(currentUserType, usageScore, data);

    // Determine next likely user type
    const nextLikelyUserType = this.predictNextUserType(currentUserType, progressionLikelihood);

    // Identify behavior patterns
    const behaviorPatterns = this.identifyBehaviorPatterns(data, usageScore);

    return {
      currentUserType,
      daysInCurrentType: data.days_in_current_state || 0,
      progressionLikelihood,
      nextLikelyUserType,
      behaviorPatterns
    };
  }

  /**
   * Calculate usage score for progression analysis
   */
  private static calculateUsageScore(data: any): number {
    const activeDays = Number(data.active_days_last_30) || 0;
    const totalActions = Number(data.total_actions_last_30) || 0;
    const activeUsers = Number(data.unique_active_users) || 0;

    // Normalize scores (0-1 range)
    const dayScore = Math.min(activeDays / 20, 1); // 20+ active days = high usage
    const actionScore = Math.min(totalActions / 500, 1); // 500+ actions = high usage
    const userScore = Math.min(activeUsers / 5, 1); // 5+ active users = collaborative team

    return (dayScore * 0.4 + actionScore * 0.4 + userScore * 0.2);
  }

  /**
   * Calculate likelihood of user type progression
   */
  private static calculateProgressionLikelihood(userType: UserType, usageScore: number, data: any): number {
    let baseScore = usageScore * 100;

    switch (userType) {
      case UserType.TRIAL:
        // High usage in trial likely leads to conversion
        return Math.min(baseScore + 20, 95);
      
      case UserType.FREE:
        // Free users with high usage likely to upgrade
        const userCount = Number(data.unique_active_users) || 0;
        if (userCount >= 3) baseScore += 30; // At user limit
        return Math.min(baseScore, 80);
      
      case UserType.CUSTOM_PLAN:
        // Custom plan users may migrate for standardization
        return Math.min(baseScore * 0.6 + 10, 60);
      
      case UserType.APPSUMO:
        // AppSumo users need to migrate within deadline
        return 90; // High urgency
      
      default:
        return Math.min(baseScore, 50);
    }
  }

  /**
   * Predict next likely user type
   */
  private static predictNextUserType(currentType: UserType, likelihood: number): UserType | undefined {
    if (likelihood < 30) return undefined;

    switch (currentType) {
      case UserType.TRIAL:
        return UserType.ACTIVE_SUBSCRIBER;
      case UserType.FREE:
        return UserType.ACTIVE_SUBSCRIBER;
      case UserType.CUSTOM_PLAN:
        return UserType.ACTIVE_SUBSCRIBER;
      case UserType.APPSUMO:
        return UserType.ACTIVE_SUBSCRIBER;
      default:
        return undefined;
    }
  }

  /**
   * Identify behavior patterns
   */
  private static identifyBehaviorPatterns(data: any, usageScore: number): string[] {
    const patterns: string[] = [];

    const activeDays = Number(data.active_days_last_30) || 0;
    const totalActions = Number(data.total_actions_last_30) || 0;
    const activeUsers = Number(data.unique_active_users) || 0;

    if (activeDays >= 20) patterns.push("High engagement - active 20+ days per month");
    else if (activeDays >= 10) patterns.push("Regular usage - active 10+ days per month");
    else if (activeDays >= 5) patterns.push("Moderate usage - active 5+ days per month");
    else patterns.push("Low engagement - sporadic usage");

    if (activeUsers >= 5) patterns.push("Collaborative team - 5+ active members");
    else if (activeUsers >= 3) patterns.push("Small team collaboration");
    else if (activeUsers >= 2) patterns.push("Pair collaboration");
    else patterns.push("Individual user");

    if (totalActions >= 500) patterns.push("Power user behavior - high action volume");
    else if (totalActions >= 200) patterns.push("Regular user behavior");
    else if (totalActions >= 50) patterns.push("Light user behavior");
    else patterns.push("Minimal usage pattern");

    if (usageScore >= 0.8) patterns.push("Ideal candidate for premium features");
    else if (usageScore >= 0.6) patterns.push("Good candidate for plan upgrade");
    else if (usageScore >= 0.4) patterns.push("Moderate upgrade potential");
    else patterns.push("Low upgrade likelihood");

    return patterns;
  }

  /**
   * Generate usage insights and recommendations
   */
  public static async generateUsageInsights(organizationId: string): Promise<{
    insights: string[];
    recommendations: string[];
    optimizations: string[];
    growthOpportunities: string[];
  }> {
    const [usageMetrics, userProgression] = await Promise.all([
      this.analyzeUsagePatterns(organizationId),
      this.analyzeUserTypeProgression(organizationId)
    ]);

    const insights = this.generateInsights(usageMetrics, userProgression);
    const recommendations = this.generateRecommendations(usageMetrics, userProgression);
    const optimizations = this.generateOptimizations(usageMetrics);
    const growthOpportunities = this.generateGrowthOpportunities(usageMetrics, userProgression);

    return {
      insights,
      recommendations,
      optimizations,
      growthOpportunities
    };
  }

  private static generateInsights(usageMetrics: UsageMetrics, userProgression: any): string[] {
    const insights: string[] = [];

    // User insights
    if (usageMetrics.activeUsers > 0) {
      const activeRatio = usageMetrics.activeUsers / usageMetrics.totalUsers;
      if (activeRatio >= 0.8) insights.push(`High team engagement: ${Math.round(activeRatio * 100)}% of users actively participate`);
      else if (activeRatio >= 0.6) insights.push(`Good team participation: ${Math.round(activeRatio * 100)}% of users are active`);
      else insights.push(`Low user activation: Only ${Math.round(activeRatio * 100)}% of users are active`);
    }

    // Feature insights
    if (usageMetrics.featureUtilization.ganttCharts >= 0.7) {
      insights.push("Strong project planning focus - high Gantt chart usage");
    }
    if (usageMetrics.featureUtilization.timeTracking >= 0.6) {
      insights.push("Time-conscious team - actively tracking work hours");
    }
    if (usageMetrics.featureUtilization.customFields >= 0.5) {
      insights.push("Process customization - actively using custom fields");
    }

    // Growth insights
    if (usageMetrics.growthTrend.userGrowthRate >= 0.2) {
      insights.push("Rapid team expansion - 20%+ monthly user growth");
    }
    if (usageMetrics.growthTrend.projectGrowthRate >= 0.3) {
      insights.push("High project velocity - 30%+ monthly project growth");
    }

    // Collaboration insights
    if (usageMetrics.teamCollaborationIndex >= 0.8) {
      insights.push("Highly collaborative team - excellent communication patterns");
    }
    if (usageMetrics.averageProjectComplexity >= 0.7) {
      insights.push("Complex project management - handling sophisticated workflows");
    }

    return insights;
  }

  private static generateRecommendations(usageMetrics: UsageMetrics, userProgression: any): string[] {
    const recommendations: string[] = [];

    // Based on user type and progression
    if (userProgression.currentUserType === UserType.TRIAL && userProgression.progressionLikelihood >= 70) {
      recommendations.push("High conversion probability - consider Pro plan for continued access");
    }
    if (userProgression.currentUserType === UserType.FREE && usageMetrics.totalUsers >= 3) {
      recommendations.push("At user limit - upgrade to add more team members");
    }

    // Based on feature utilization
    if (usageMetrics.featureUtilization.ganttCharts >= 0.5 && usageMetrics.featureUtilization.reporting < 0.3) {
      recommendations.push("Consider Business plan for advanced project reporting");
    }
    if (usageMetrics.featureUtilization.clientPortal < 0.2 && usageMetrics.totalProjects >= 5) {
      recommendations.push("Enable client portal for better project transparency");
    }

    // Based on growth trends
    if (usageMetrics.growthTrend.predicted6MonthUsers > usageMetrics.totalUsers * 2) {
      recommendations.push("Plan for scaling - consider larger plan tier for projected growth");
    }

    // Based on collaboration patterns
    if (usageMetrics.teamCollaborationIndex >= 0.7 && usageMetrics.featureUtilization.resourceManagement < 0.4) {
      recommendations.push("High collaboration detected - resource management features could improve efficiency");
    }

    return recommendations;
  }

  private static generateOptimizations(usageMetrics: UsageMetrics): string[] {
    const optimizations: string[] = [];

    // Feature adoption optimizations
    if (usageMetrics.featureUtilization.timeTracking < 0.3) {
      optimizations.push("Enable time tracking for better project insights");
    }
    if (usageMetrics.featureUtilization.customFields < 0.2) {
      optimizations.push("Utilize custom fields to capture project-specific data");
    }
    if (usageMetrics.featureUtilization.ganttCharts < 0.4 && usageMetrics.averageProjectComplexity >= 0.6) {
      optimizations.push("Complex projects would benefit from Gantt chart planning");
    }

    // User engagement optimizations
    const activeRatio = usageMetrics.activeUsers / usageMetrics.totalUsers;
    if (activeRatio < 0.6) {
      optimizations.push("Improve user onboarding to increase team participation");
    }

    // Storage optimizations
    if (usageMetrics.storageUsed > 40 * 1024 * 1024 * 1024) { // 40GB
      optimizations.push("Consider archiving old project files to optimize storage");
    }

    return optimizations;
  }

  private static generateGrowthOpportunities(usageMetrics: UsageMetrics, userProgression: any): string[] {
    const opportunities: string[] = [];

    // Based on current trajectory
    if (usageMetrics.growthTrend.userGrowthRate >= 0.15) {
      opportunities.push("Rapid growth trajectory - prepare for team scaling");
    }
    if (usageMetrics.growthTrend.projectGrowthRate >= 0.2) {
      opportunities.push("High project velocity - consider portfolio management features");
    }

    // Based on feature potential
    if (usageMetrics.featureUtilization.clientPortal < 0.2 && usageMetrics.totalProjects >= 3) {
      opportunities.push("Client portal adoption could improve customer relationships");
    }
    if (usageMetrics.featureUtilization.reporting < 0.4 && usageMetrics.totalProjects >= 5) {
      opportunities.push("Advanced reporting could provide valuable business insights");
    }

    // Based on collaboration patterns
    if (usageMetrics.teamCollaborationIndex >= 0.6 && usageMetrics.totalUsers < 10) {
      opportunities.push("Strong collaboration foundation - ready for team expansion");
    }

    // Based on user type progression
    if (userProgression.progressionLikelihood >= 60) {
      opportunities.push("High upgrade potential - prime candidate for premium features");
    }

    return opportunities;
  }
}