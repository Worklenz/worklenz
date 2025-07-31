import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import db from "../config/db";
import { SpamDetector } from "../utils/spam-detector";
import { RateLimiter } from "../middleware/rate-limiter";

export default class ModerationController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async getFlaggedOrganizations(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.user?.is_admin) {
      return res.status(403).send(new ServerResponse(false, null, "Admin access required"));
    }

    const q = `
      SELECT * FROM moderation_dashboard
      ORDER BY last_moderation_date DESC
      LIMIT 100;
    `;
    
    const result = await db.query(q);
    
    // Add spam analysis to each result
    const flaggedTeams = result.rows.map(team => {
      const orgSpamCheck = SpamDetector.detectSpam(team.organization_name);
      const ownerSpamCheck = SpamDetector.detectSpam(team.owner_name);
      
      return {
        ...team,
        org_spam_score: orgSpamCheck.score,
        org_spam_reasons: orgSpamCheck.reasons,
        owner_spam_score: ownerSpamCheck.score,
        owner_spam_reasons: ownerSpamCheck.reasons,
        is_high_risk: SpamDetector.isHighRiskContent(team.organization_name) || 
                      SpamDetector.isHighRiskContent(team.owner_name)
      };
    });

    return res.status(200).send(new ServerResponse(true, flaggedTeams));
  }

  @HandleExceptions()
  public static async flagOrganization(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.user?.is_admin) {
      return res.status(403).send(new ServerResponse(false, null, "Admin access required"));
    }

    const { teamId, reason } = req.body;
    if (!teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Team ID is required"));
    }

    const q = `SELECT update_team_status($1, 'flagged', $2, $3) as result`;
    const result = await db.query(q, [teamId, reason || 'Spam/Abuse', req.user.id]);
    
    const teamQuery = `SELECT id, name FROM teams WHERE id = $1`;
    const teamResult = await db.query(teamQuery, [teamId]);
    
    if (teamResult.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
    }

    return res.status(200).send(new ServerResponse(true, teamResult.rows[0], "Organization flagged successfully"));
  }

  @HandleExceptions()
  public static async suspendOrganization(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.user?.is_admin) {
      return res.status(403).send(new ServerResponse(false, null, "Admin access required"));
    }

    const { teamId, reason, expiresAt } = req.body;
    if (!teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Team ID is required"));
    }

    const q = `SELECT update_team_status($1, 'suspended', $2, $3, $4) as result`;
    const result = await db.query(q, [teamId, reason || 'Terms of Service Violation', req.user.id, expiresAt || null]);
    
    const teamQuery = `SELECT id, name FROM teams WHERE id = $1`;
    const teamResult = await db.query(teamQuery, [teamId]);
    
    if (teamResult.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
    }

    return res.status(200).send(new ServerResponse(true, teamResult.rows[0], "Organization suspended successfully"));
  }

  @HandleExceptions()
  public static async unsuspendOrganization(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.user?.is_admin) {
      return res.status(403).send(new ServerResponse(false, null, "Admin access required"));
    }

    const { teamId } = req.body;
    if (!teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Team ID is required"));
    }

    const q = `SELECT update_team_status($1, 'active', 'Manually restored by admin', $2) as result`;
    const result = await db.query(q, [teamId, req.user.id]);
    
    const teamQuery = `SELECT id, name FROM teams WHERE id = $1`;
    const teamResult = await db.query(teamQuery, [teamId]);
    
    if (teamResult.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
    }

    return res.status(200).send(new ServerResponse(true, teamResult.rows[0], "Organization restored successfully"));
  }

  @HandleExceptions()
  public static async scanForSpam(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.user?.is_admin) {
      return res.status(403).send(new ServerResponse(false, null, "Admin access required"));
    }

    const q = `
      SELECT t.id, t.name as organization_name, u.name as owner_name, u.email as owner_email, 
             t.created_at
      FROM teams t 
      INNER JOIN users u ON t.user_id = u.id
      WHERE t.status = 'active'
      AND t.created_at > NOW() - INTERVAL '7 days'
      ORDER BY t.created_at DESC;
    `;
    
    const result = await db.query(q);
    const suspiciousTeams = [];

    for (const team of result.rows) {
      const orgSpamCheck = SpamDetector.detectSpam(team.organization_name);
      const ownerSpamCheck = SpamDetector.detectSpam(team.owner_name);
      
      if (orgSpamCheck.isSpam || ownerSpamCheck.isSpam || 
          SpamDetector.isHighRiskContent(team.organization_name) ||
          SpamDetector.isHighRiskContent(team.owner_name)) {
        
        suspiciousTeams.push({
          ...team,
          org_spam_score: orgSpamCheck.score,
          org_spam_reasons: orgSpamCheck.reasons,
          owner_spam_score: ownerSpamCheck.score,
          owner_spam_reasons: ownerSpamCheck.reasons,
          is_high_risk: SpamDetector.isHighRiskContent(team.organization_name) || 
                        SpamDetector.isHighRiskContent(team.owner_name)
        });
      }
    }

    return res.status(200).send(new ServerResponse(true, {
      total_scanned: result.rows.length,
      suspicious_count: suspiciousTeams.length,
      suspicious_teams: suspiciousTeams
    }));
  }

  @HandleExceptions()
  public static async getModerationStats(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.user?.is_admin) {
      return res.status(403).send(new ServerResponse(false, null, "Admin access required"));
    }

    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM teams WHERE status = 'flagged') as flagged_count,
        (SELECT COUNT(*) FROM teams WHERE status = 'suspended') as suspended_count,
        (SELECT COUNT(*) FROM teams WHERE created_at > NOW() - INTERVAL '24 hours') as new_teams_24h,
        (SELECT COUNT(*) FROM teams WHERE created_at > NOW() - INTERVAL '7 days') as new_teams_7d
    `;
    
    const result = await db.query(statsQuery);
    const stats = result.rows[0];

    // Get rate limiting stats for recent activity
    const recentInviteActivity = RateLimiter.getStats(req.user?.id || '');

    return res.status(200).send(new ServerResponse(true, {
      ...stats,
      rate_limit_stats: recentInviteActivity
    }));
  }

  @HandleExceptions()
  public static async bulkScanAndFlag(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.user?.is_admin) {
      return res.status(403).send(new ServerResponse(false, null, "Admin access required"));
    }

    const { autoFlag = false } = req.body;

    const q = `
      SELECT t.id, t.name as organization_name, u.name as owner_name
      FROM teams t 
      INNER JOIN users u ON t.user_id = u.id
      WHERE t.status = 'active'
      AND t.created_at > NOW() - INTERVAL '30 days'
      LIMIT 1000;
    `;
    
    const result = await db.query(q);
    const flaggedTeams = [];

    for (const team of result.rows) {
      const orgSpamCheck = SpamDetector.detectSpam(team.organization_name);
      const ownerSpamCheck = SpamDetector.detectSpam(team.owner_name);
      const isHighRisk = SpamDetector.isHighRiskContent(team.organization_name) || 
                         SpamDetector.isHighRiskContent(team.owner_name);
      
      if ((orgSpamCheck.score > 70 || ownerSpamCheck.score > 70 || isHighRisk) && autoFlag) {
        // Auto-flag high-confidence spam
        const reasons = [
          ...orgSpamCheck.reasons,
          ...ownerSpamCheck.reasons,
          ...(isHighRisk ? ['High-risk content detected'] : [])
        ];
        
        const flagQuery = `SELECT update_team_status($1, 'flagged', $2, $3) as result`;
        await db.query(flagQuery, [
          team.id,
          `Auto-flagged: ${reasons.join(', ')}`,
          req.user.id
        ]);
        
        flaggedTeams.push({
          ...team,
          action: 'flagged',
          reasons: reasons
        });
      } else if (orgSpamCheck.isSpam || ownerSpamCheck.isSpam || isHighRisk) {
        flaggedTeams.push({
          ...team,
          action: 'review_needed',
          org_spam_score: orgSpamCheck.score,
          owner_spam_score: ownerSpamCheck.score,
          reasons: [...orgSpamCheck.reasons, ...ownerSpamCheck.reasons, ...(isHighRisk ? ['High-risk content'] : [])]
        });
      }
    }

    return res.status(200).send(new ServerResponse(true, {
      total_scanned: result.rows.length,
      auto_flagged: flaggedTeams.filter(t => t.action === 'flagged').length,
      needs_review: flaggedTeams.filter(t => t.action === 'review_needed').length,
      teams: flaggedTeams
    }));
  }
}