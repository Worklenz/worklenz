# Worklenz Slack Integration Development Guide

## Overview
This document provides instructions for implementing a dynamic Slack integration with Worklenz, allowing any Worklenz team to install the Worklenz Slack app to their own workspace. Each team can independently configure notifications, create tasks, and interact with their projects directly from their Slack workspace.

## Architecture Overview

### Multi-Tenant Design
- **One Slack App**: Single Worklenz Slack app that can be installed to multiple workspaces
- **Per-Team Installation**: Each Worklenz team can connect their own Slack workspace
- **Isolated Configurations**: Each team's Slack settings are completely isolated
- **Dynamic OAuth Flow**: Users initiate installation from within Worklenz
- **Workspace Mapping**: Each Slack workspace is mapped to a specific Worklenz team

## Prerequisites

### 1. Slack App Setup (One-time by Worklenz)
1. Go to [api.slack.com](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name: "Worklenz"
4. Choose a workspace for development/testing
5. Note down the following credentials:
   - Client ID
   - Client Secret
   - Signing Secret
   - Verification Token
6. Configure Distribution Settings:
   - Enable "Public Distribution"
   - Add App Description, Icon, and Screenshots
   - Configure OAuth & Permissions redirect URLs

### 2. Required OAuth Scopes
Configure these OAuth scopes in your Slack app settings under "OAuth & Permissions":

**Bot Token Scopes:**
- `chat:write` - Post messages
- `channels:read` - View basic channel info
- `groups:read` - View private channels
- `im:read` - View direct messages
- `mpim:read` - View group direct messages
- `users:read` - View users in workspace
- `users:read.email` - View user email addresses
- `commands` - Add slash commands
- `incoming-webhook` - Post messages to specific channels

**User Token Scopes (if needed):**
- `identity.basic` - View user's name and workspace
- `identity.email` - View user's email address

### 3. Event Subscriptions
Enable Event Subscriptions and configure:
- Request URL: `https://app.worklenz.com/api/slack/events` (production)
- Subscribe to Bot Events:
  - `message.channels` - Messages in public channels
  - `message.groups` - Messages in private channels
  - `message.im` - Direct messages
  - `app_mention` - When app is mentioned

### 4. Slash Commands
Create these slash commands:
- `/worklenz-task` - Create a new task
- `/worklenz-project` - View project info
- `/worklenz-assign` - Assign tasks

## Backend Implementation

### 1. Install Required Packages
```bash
cd worklenz-backend
npm install @slack/web-api @slack/events-api @slack/interactive-messages
npm install --save-dev @types/node
```

### 2. Environment Variables
Add to `.env`:
```env
# Slack Configuration (Worklenz App Credentials)
SLACK_CLIENT_ID=your_client_id
SLACK_CLIENT_SECRET=your_client_secret
SLACK_SIGNING_SECRET=your_signing_secret
SLACK_VERIFICATION_TOKEN=your_verification_token
SLACK_REDIRECT_URI=https://app.worklenz.com/api/slack/oauth/callback
SLACK_APP_ID=your_app_id

# For local development
# SLACK_REDIRECT_URI=http://localhost:3000/api/slack/oauth/callback
```

### 3. Database Schema
Create tables for Slack integration:

```sql
-- Slack workspace installations
CREATE TABLE slack_workspaces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    slack_team_id VARCHAR(255) NOT NULL UNIQUE,
    slack_team_name VARCHAR(255),
    bot_token TEXT NOT NULL,
    bot_user_id VARCHAR(255),
    app_id VARCHAR(255),
    installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    installed_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Slack user mappings
CREATE TABLE slack_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    slack_workspace_id UUID REFERENCES slack_workspaces(id) ON DELETE CASCADE,
    slack_user_id VARCHAR(255) NOT NULL,
    slack_username VARCHAR(255),
    slack_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(slack_workspace_id, slack_user_id)
);

-- Slack channel configurations
CREATE TABLE slack_channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slack_workspace_id UUID REFERENCES slack_workspaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    slack_channel_id VARCHAR(255) NOT NULL,
    slack_channel_name VARCHAR(255),
    notification_types JSONB DEFAULT '["task_created", "task_completed", "task_assigned", "comment_added"]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(slack_workspace_id, slack_channel_id)
);

-- Slack notification queue
CREATE TABLE slack_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slack_workspace_id UUID REFERENCES slack_workspaces(id) ON DELETE CASCADE,
    channel_id VARCHAR(255) NOT NULL,
    message JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed
    attempts INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_slack_workspaces_team_id ON slack_workspaces(team_id);
CREATE INDEX idx_slack_users_user_id ON slack_users(user_id);
CREATE INDEX idx_slack_channels_project_id ON slack_channels(project_id);
CREATE INDEX idx_slack_notifications_status ON slack_notifications(status);
```

### 4. Create Slack Service
Create `src/services/slack/slack.service.ts`:

```typescript
import { WebClient } from '@slack/web-api';
import { createEventAdapter } from '@slack/events-api';
import { Request, Response } from 'express';
import crypto from 'crypto';
import db from '../../config/db';

export class SlackService {
    private slackEvents: any;

    constructor() {
        this.slackEvents = createEventAdapter(process.env.SLACK_SIGNING_SECRET!);
    }

    // Initialize Slack client for a specific workspace
    private getClient(botToken: string): WebClient {
        return new WebClient(botToken);
    }

    // Generate installation URL for a team
    generateInstallUrl(teamId: string, userId: string): string {
        const state = this.generateState(teamId, userId);
        const scopes = 'chat:write,channels:read,groups:read,im:read,mpim:read,users:read,users:read.email,commands,incoming-webhook';
        
        const params = new URLSearchParams({
            client_id: process.env.SLACK_CLIENT_ID!,
            scope: scopes,
            redirect_uri: process.env.SLACK_REDIRECT_URI!,
            state: state,
            team: '' // Allow user to choose their workspace
        });

        return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
    }

    // Generate secure state parameter
    private generateState(teamId: string, userId: string): string {
        const stateData = {
            teamId,
            userId,
            timestamp: Date.now(),
            nonce: crypto.randomBytes(16).toString('hex')
        };
        
        // Encrypt state data
        const cipher = crypto.createCipher('aes-256-cbc', process.env.SESSION_SECRET!);
        let encrypted = cipher.update(JSON.stringify(stateData), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return encrypted;
    }

    // Verify and decode state parameter
    private verifyState(state: string): { teamId: string; userId: string } {
        try {
            const decipher = crypto.createDecipher('aes-256-cbc', process.env.SESSION_SECRET!);
            let decrypted = decipher.update(state, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            const stateData = JSON.parse(decrypted);
            
            // Verify timestamp (expire after 10 minutes)
            if (Date.now() - stateData.timestamp > 600000) {
                throw new Error('State expired');
            }
            
            return {
                teamId: stateData.teamId,
                userId: stateData.userId
            };
        } catch (error) {
            throw new Error('Invalid state parameter');
        }
    }

    // OAuth installation callback
    async handleOAuthCallback(code: string, state: string): Promise<{ teamId: string; success: boolean }> {
        // Verify state
        const { teamId, userId } = this.verifyState(state);
        
        const client = new WebClient();
        
        try {
            const result = await client.oauth.v2.access({
                client_id: process.env.SLACK_CLIENT_ID!,
                client_secret: process.env.SLACK_CLIENT_SECRET!,
                code,
                redirect_uri: process.env.SLACK_REDIRECT_URI!
            });

            if (result.ok && result.access_token) {
                // Store installation details for this team
                await this.saveWorkspaceInstallation({
                    teamId,
                    slackTeamId: result.team?.id,
                    slackTeamName: result.team?.name,
                    botToken: result.access_token,
                    botUserId: result.bot_user_id,
                    appId: result.app_id,
                    installedBy: userId,
                    authedUser: result.authed_user
                });

                // Fetch and store available channels
                await this.syncSlackChannels(teamId, result.access_token);

                return { teamId, success: true };
            }
            
            throw new Error('Invalid OAuth response');
        } catch (error) {
            console.error('OAuth error:', error);
            throw error;
        }
    }

    // Save workspace installation
    private async saveWorkspaceInstallation(data: any): Promise<void> {
        const query = `
            INSERT INTO slack_workspaces (
                team_id, slack_team_id, slack_team_name, 
                bot_token, bot_user_id, app_id, installed_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (slack_team_id) 
            DO UPDATE SET 
                team_id = $1,
                bot_token = $4,
                updated_at = CURRENT_TIMESTAMP,
                is_active = true,
                installed_by = $7
        `;
        
        await db.query(query, [
            data.teamId,
            data.slackTeamId,
            data.slackTeamName,
            data.botToken,
            data.botUserId,
            data.appId,
            data.installedBy
        ]);
    }

    // Sync available Slack channels for the team
    private async syncSlackChannels(teamId: string, botToken: string): Promise<void> {
        const client = this.getClient(botToken);
        
        try {
            // Get public channels
            const publicChannels = await client.conversations.list({
                types: 'public_channel',
                exclude_archived: true,
                limit: 1000
            });

            // Get private channels the bot is a member of
            const privateChannels = await client.conversations.list({
                types: 'private_channel',
                exclude_archived: true,
                limit: 1000
            });

            // Store channel list in cache or database for quick access
            const channels = [
                ...(publicChannels.channels || []),
                ...(privateChannels.channels || [])
            ];

            // Store in Redis or database cache
            await this.cacheChannelList(teamId, channels);
        } catch (error) {
            console.error('Error syncing channels:', error);
        }
    }

    // Cache channel list for quick access
    private async cacheChannelList(teamId: string, channels: any[]): Promise<void> {
        // Store in Redis or database with TTL
        // This is used for the channel selector in the UI
        const cacheKey = `slack:channels:${teamId}`;
        const cacheData = channels.map(ch => ({
            id: ch.id,
            name: ch.name,
            is_private: ch.is_private
        }));
        
        // Store with 1 hour TTL
        // await redis.setex(cacheKey, 3600, JSON.stringify(cacheData));
    }

    // Send notification to Slack
    async sendNotification(
        workspaceId: string, 
        channelId: string, 
        message: any
    ): Promise<void> {
        try {
            // Get workspace token
            const workspace = await this.getWorkspace(workspaceId);
            if (!workspace || !workspace.bot_token) {
                throw new Error('Workspace not found or not configured');
            }

            const client = this.getClient(workspace.bot_token);
            
            // Send message
            await client.chat.postMessage({
                channel: channelId,
                ...message
            });

            // Log successful notification
            await this.logNotification(workspaceId, channelId, message, 'sent');
        } catch (error) {
            // Log failed notification
            await this.logNotification(workspaceId, channelId, message, 'failed', error.message);
            throw error;
        }
    }

    // Get workspace details by team ID
    async getWorkspaceByTeamId(teamId: string): Promise<any> {
        const query = `
            SELECT * FROM slack_workspaces 
            WHERE team_id = $1 AND is_active = true
        `;
        const result = await db.query(query, [teamId]);
        return result.rows[0];
    }

    // Get workspace details
    private async getWorkspace(workspaceId: string): Promise<any> {
        const query = `
            SELECT * FROM slack_workspaces 
            WHERE id = $1 AND is_active = true
        `;
        const result = await db.query(query, [workspaceId]);
        return result.rows[0];
    }

    // Disconnect Slack workspace for a team
    async disconnectWorkspace(teamId: string): Promise<void> {
        const query = `
            UPDATE slack_workspaces 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE team_id = $1
        `;
        await db.query(query, [teamId]);
        
        // Also deactivate all channel configurations
        const channelQuery = `
            UPDATE slack_channels 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE slack_workspace_id IN (
                SELECT id FROM slack_workspaces WHERE team_id = $1
            )
        `;
        await db.query(channelQuery, [teamId]);
    }

    // Get available Slack channels for a team
    async getAvailableChannels(teamId: string): Promise<any[]> {
        const workspace = await this.getWorkspaceByTeamId(teamId);
        if (!workspace) {
            throw new Error('Slack workspace not connected');
        }

        const client = this.getClient(workspace.bot_token);
        
        try {
            const result = await client.conversations.list({
                types: 'public_channel,private_channel',
                exclude_archived: true,
                limit: 1000
            });

            return result.channels?.map(ch => ({
                id: ch.id,
                name: ch.name,
                is_private: ch.is_private,
                num_members: ch.num_members
            })) || [];
        } catch (error) {
            console.error('Error fetching channels:', error);
            throw error;
        }
    }

    // Log notification
    private async logNotification(
        workspaceId: string,
        channelId: string,
        message: any,
        status: string,
        errorMessage?: string
    ): Promise<void> {
        const query = `
            INSERT INTO slack_notifications 
            (slack_workspace_id, channel_id, message, status, error_message, sent_at)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        
        await db.query(query, [
            workspaceId,
            channelId,
            JSON.stringify(message),
            status,
            errorMessage,
            status === 'sent' ? new Date() : null
        ]);
    }

    // Handle slash commands
    async handleSlashCommand(req: Request, res: Response): Promise<void> {
        const { command, text, user_id, team_id, channel_id } = req.body;

        switch (command) {
            case '/worklenz-task':
                await this.handleCreateTask(text, user_id, team_id, channel_id, res);
                break;
            case '/worklenz-project':
                await this.handleProjectInfo(text, user_id, team_id, channel_id, res);
                break;
            case '/worklenz-assign':
                await this.handleAssignTask(text, user_id, team_id, channel_id, res);
                break;
            default:
                res.json({ text: 'Unknown command' });
        }
    }

    // Create task from Slack
    private async handleCreateTask(
        text: string, 
        userId: string, 
        teamId: string, 
        channelId: string,
        res: Response
    ): Promise<void> {
        // Parse task details from text
        // Format: "Task name | Project name | Assignee | Due date"
        const parts = text.split('|').map(p => p.trim());
        
        if (parts.length < 2) {
            res.json({
                response_type: 'ephemeral',
                text: 'Usage: /worklenz-task Task name | Project name | Assignee (optional) | Due date (optional)'
            });
            return;
        }

        try {
            // Create task logic here
            // 1. Find project by name
            // 2. Find assignee if provided
            // 3. Create task in database
            // 4. Send confirmation

            res.json({
                response_type: 'in_channel',
                text: `✅ Task "${parts[0]}" created in project "${parts[1]}"`
            });
        } catch (error) {
            res.json({
                response_type: 'ephemeral',
                text: `❌ Failed to create task: ${error.message}`
            });
        }
    }

    // Get project info
    private async handleProjectInfo(
        text: string,
        userId: string,
        teamId: string,
        channelId: string,
        res: Response
    ): Promise<void> {
        // Implementation for project info
        res.json({
            response_type: 'ephemeral',
            text: 'Project info implementation pending'
        });
    }

    // Assign task
    private async handleAssignTask(
        text: string,
        userId: string,
        teamId: string,
        channelId: string,
        res: Response
    ): Promise<void> {
        // Implementation for task assignment
        res.json({
            response_type: 'ephemeral',
            text: 'Task assignment implementation pending'
        });
    }
}
```

### 5. Create Slack Routes
Create `src/routes/slack.routes.ts`:

```typescript
import { Router } from 'express';
import { SlackService } from '../services/slack/slack.service';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const slackService = new SlackService();

// Get Slack connection status for current team
router.get('/status', authMiddleware, async (req, res) => {
    try {
        const teamId = req.user.teamId;
        const workspace = await slackService.getWorkspaceByTeamId(teamId);
        
        res.json({
            connected: !!workspace,
            workspace: workspace ? {
                name: workspace.slack_team_name,
                id: workspace.slack_team_id
            } : null
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get Slack status' });
    }
});

// Generate installation URL
router.get('/install-url', authMiddleware, async (req, res) => {
    try {
        const teamId = req.user.teamId;
        const userId = req.user.id;
        const installUrl = slackService.generateInstallUrl(teamId, userId);
        
        res.json({ url: installUrl });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate install URL' });
    }
});

// OAuth callback
router.get('/oauth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    
    if (error) {
        // User denied the installation
        res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?slack=cancelled`);
        return;
    }
    
    try {
        const result = await slackService.handleOAuthCallback(
            code as string, 
            state as string
        );
        
        // Redirect to success page in frontend
        res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?slack=success`);
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?slack=error`);
    }
});

// Disconnect Slack
router.delete('/disconnect', authMiddleware, async (req, res) => {
    try {
        const teamId = req.user.teamId;
        await slackService.disconnectWorkspace(teamId);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to disconnect Slack' });
    }
});

// Get available channels
router.get('/channels', authMiddleware, async (req, res) => {
    try {
        const teamId = req.user.teamId;
        const channels = await slackService.getAvailableChannels(teamId);
        
        res.json(channels);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get channels' });
    }
});

// Slash commands
router.post('/commands', async (req, res) => {
    await slackService.handleSlashCommand(req, res);
});

// Event subscriptions
router.post('/events', async (req, res) => {
    // Slack URL verification
    if (req.body.type === 'url_verification') {
        res.json({ challenge: req.body.challenge });
        return;
    }

    // Handle events
    // Implementation for handling different event types
    res.status(200).send();
});

// Interactive components (buttons, menus, etc.)
router.post('/interactive', async (req, res) => {
    const payload = JSON.parse(req.body.payload);
    // Handle interactive components
    res.status(200).send();
});

export default router;
```

### 6. Notification Service Integration
Create `src/services/slack/notification-handler.ts`:

```typescript
import { SlackService } from './slack.service';
import db from '../../config/db';

export class SlackNotificationHandler {
    private slackService: SlackService;

    constructor() {
        this.slackService = new SlackService();
    }

    // Send notification when task is created
    async notifyTaskCreated(taskId: string): Promise<void> {
        const task = await this.getTaskDetails(taskId);
        const channels = await this.getProjectChannels(task.project_id);

        for (const channel of channels) {
            if (this.shouldNotify(channel, 'task_created')) {
                const message = this.formatTaskCreatedMessage(task);
                await this.slackService.sendNotification(
                    channel.slack_workspace_id,
                    channel.slack_channel_id,
                    message
                );
            }
        }
    }

    // Send notification when task is completed
    async notifyTaskCompleted(taskId: string): Promise<void> {
        const task = await this.getTaskDetails(taskId);
        const channels = await this.getProjectChannels(task.project_id);

        for (const channel of channels) {
            if (this.shouldNotify(channel, 'task_completed')) {
                const message = this.formatTaskCompletedMessage(task);
                await this.slackService.sendNotification(
                    channel.slack_workspace_id,
                    channel.slack_channel_id,
                    message
                );
            }
        }
    }

    // Send notification when task is assigned
    async notifyTaskAssigned(taskId: string, assigneeId: string): Promise<void> {
        const task = await this.getTaskDetails(taskId);
        const assignee = await this.getUserDetails(assigneeId);
        const channels = await this.getProjectChannels(task.project_id);

        for (const channel of channels) {
            if (this.shouldNotify(channel, 'task_assigned')) {
                const message = this.formatTaskAssignedMessage(task, assignee);
                await this.slackService.sendNotification(
                    channel.slack_workspace_id,
                    channel.slack_channel_id,
                    message
                );
            }
        }
    }

    // Get task details
    private async getTaskDetails(taskId: string): Promise<any> {
        const query = `
            SELECT t.*, p.name as project_name 
            FROM tasks t
            JOIN projects p ON t.project_id = p.id
            WHERE t.id = $1
        `;
        const result = await db.query(query, [taskId]);
        return result.rows[0];
    }

    // Get user details
    private async getUserDetails(userId: string): Promise<any> {
        const query = `SELECT * FROM users WHERE id = $1`;
        const result = await db.query(query, [userId]);
        return result.rows[0];
    }

    // Get project channels
    private async getProjectChannels(projectId: string): Promise<any[]> {
        const query = `
            SELECT * FROM slack_channels 
            WHERE project_id = $1 AND is_active = true
        `;
        const result = await db.query(query, [projectId]);
        return result.rows;
    }

    // Check if should notify
    private shouldNotify(channel: any, notificationType: string): boolean {
        return channel.notification_types?.includes(notificationType) ?? false;
    }

    // Format messages
    private formatTaskCreatedMessage(task: any): any {
        return {
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `🆕 *New Task Created*\n*${task.name}*\nProject: ${task.project_name}`
                    }
                },
                {
                    type: 'actions',
                    elements: [
                        {
                            type: 'button',
                            text: {
                                type: 'plain_text',
                                text: 'View Task'
                            },
                            url: `${process.env.FRONTEND_URL}/projects/${task.project_id}/tasks/${task.id}`
                        }
                    ]
                }
            ]
        };
    }

    private formatTaskCompletedMessage(task: any): any {
        return {
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `✅ *Task Completed*\n*${task.name}*\nProject: ${task.project_name}`
                    }
                }
            ]
        };
    }

    private formatTaskAssignedMessage(task: any, assignee: any): any {
        return {
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `👤 *Task Assigned*\n*${task.name}*\nAssigned to: ${assignee.name}\nProject: ${task.project_name}`
                    }
                }
            ]
        };
    }
}
```

## Frontend Implementation

### 1. Create Slack Settings Component
Create `worklenz-frontend/src/components/settings/integrations/SlackIntegration.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { Button, Card, Switch, Select, Table, Tag, Modal, Form, Input, message } from 'antd';
import { SlackOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';

interface SlackChannel {
    id: string;
    projectId: string;
    projectName: string;
    slackChannelId: string;
    slackChannelName: string;
    notificationTypes: string[];
    isActive: boolean;
}

export function SlackIntegration() {
    const { t } = useTranslation();
    const [isConnected, setIsConnected] = useState(false);
    const [workspace, setWorkspace] = useState<any>(null);
    const [channels, setChannels] = useState<SlackChannel[]>([]);
    const [availableChannels, setAvailableChannels] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        checkSlackConnection();
        loadChannelConfigurations();
        loadProjects();
        
        // Check for OAuth callback params
        const params = new URLSearchParams(window.location.search);
        const slackStatus = params.get('slack');
        
        if (slackStatus === 'success') {
            message.success('Slack workspace connected successfully!');
            window.history.replaceState({}, '', window.location.pathname);
            checkSlackConnection();
        } else if (slackStatus === 'error') {
            message.error('Failed to connect Slack workspace');
            window.history.replaceState({}, '', window.location.pathname);
        } else if (slackStatus === 'cancelled') {
            message.info('Slack installation cancelled');
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    const checkSlackConnection = async () => {
        try {
            const response = await api.get('/api/slack/status');
            setIsConnected(response.data.connected);
            setWorkspace(response.data.workspace);
            
            if (response.data.connected) {
                loadAvailableChannels();
            }
        } catch (error) {
            console.error('Failed to check Slack connection:', error);
        }
    };

    const loadChannelConfigurations = async () => {
        try {
            const response = await api.get('/api/slack/channel-configs');
            setChannels(response.data);
        } catch (error) {
            console.error('Failed to load channel configurations:', error);
        }
    };

    const loadAvailableChannels = async () => {
        try {
            const response = await api.get('/api/slack/channels');
            setAvailableChannels(response.data);
        } catch (error) {
            console.error('Failed to load available channels:', error);
        }
    };

    const loadProjects = async () => {
        try {
            const response = await api.get('/api/projects');
            setProjects(response.data);
        } catch (error) {
            console.error('Failed to load projects:', error);
        }
    };

    const handleConnect = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/slack/install-url');
            
            // Open Slack OAuth in new window
            const width = 600;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;
            
            const authWindow = window.open(
                response.data.url,
                'slack-auth',
                `width=${width},height=${height},left=${left},top=${top}`
            );
            
            // Check if window was closed
            const checkInterval = setInterval(() => {
                if (authWindow?.closed) {
                    clearInterval(checkInterval);
                    setLoading(false);
                    checkSlackConnection();
                }
            }, 1000);
        } catch (error) {
            message.error('Failed to initiate Slack connection');
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        Modal.confirm({
            title: 'Disconnect Slack?',
            content: 'This will remove all Slack configurations and stop notifications for your team.',
            onOk: async () => {
                try {
                    await api.delete('/api/slack/disconnect');
                    setIsConnected(false);
                    setWorkspace(null);
                    setChannels([]);
                    setAvailableChannels([]);
                    message.success('Slack workspace disconnected successfully');
                } catch (error) {
                    message.error('Failed to disconnect Slack workspace');
                }
            }
        });
    };

    const handleAddChannel = async (values: any) => {
        try {
            await api.post('/api/integrations/slack/channels', values);
            message.success('Channel configuration added');
            setModalVisible(false);
            form.resetFields();
            loadChannelConfigurations();
        } catch (error) {
            message.error('Failed to add channel configuration');
        }
    };

    const handleToggleChannel = async (channelId: string, isActive: boolean) => {
        try {
            await api.patch(`/api/integrations/slack/channels/${channelId}`, { isActive });
            message.success('Channel status updated');
            loadChannelConfigurations();
        } catch (error) {
            message.error('Failed to update channel status');
        }
    };

    const handleDeleteChannel = async (channelId: string) => {
        try {
            await api.delete(`/api/integrations/slack/channels/${channelId}`);
            message.success('Channel configuration removed');
            loadChannelConfigurations();
        } catch (error) {
            message.error('Failed to remove channel configuration');
        }
    };

    const columns = [
        {
            title: 'Project',
            dataIndex: 'projectName',
            key: 'projectName',
        },
        {
            title: 'Slack Channel',
            dataIndex: 'slackChannelName',
            key: 'slackChannelName',
            render: (text: string) => <Tag icon={<SlackOutlined />}>{text}</Tag>
        },
        {
            title: 'Notifications',
            dataIndex: 'notificationTypes',
            key: 'notificationTypes',
            render: (types: string[]) => (
                <>
                    {types.map(type => (
                        <Tag key={type}>{type.replace('_', ' ')}</Tag>
                    ))}
                </>
            )
        },
        {
            title: 'Active',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (isActive: boolean, record: SlackChannel) => (
                <Switch 
                    checked={isActive}
                    onChange={(checked) => handleToggleChannel(record.id, checked)}
                />
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: SlackChannel) => (
                <Button 
                    type="text" 
                    danger 
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteChannel(record.id)}
                />
            )
        }
    ];

    return (
        <Card 
            title={
                <div className="flex items-center gap-2">
                    <SlackOutlined className="text-xl" />
                    <span>Slack Integration</span>
                </div>
            }
            extra={
                isConnected ? (
                    <div className="flex gap-2">
                        <Button 
                            icon={<PlusOutlined />}
                            onClick={() => setModalVisible(true)}
                        >
                            Add Channel Configuration
                        </Button>
                        <Button danger onClick={handleDisconnect}>
                            Disconnect
                        </Button>
                    </div>
                ) : (
                    <Button 
                        type="primary" 
                        onClick={handleConnect}
                        loading={loading}
                    >
                        Connect Slack Workspace
                    </Button>
                )
            }
        >
            {isConnected ? (
                <>
                    <div className="mb-4">
                        <div className="flex items-center gap-2">
                            <Tag color="success">Connected</Tag>
                            <span className="text-gray-700 font-medium">
                                {workspace?.name || 'Slack Workspace'}
                            </span>
                        </div>
                        <p className="text-gray-500 mt-2">
                            Your team's Slack workspace is connected. Configure which channels receive notifications for each project.
                        </p>
                    </div>

                    <Table 
                        columns={columns}
                        dataSource={channels}
                        rowKey="id"
                        loading={loading}
                    />

                    <Modal
                        title="Configure Slack Channel"
                        open={modalVisible}
                        onCancel={() => setModalVisible(false)}
                        footer={null}
                    >
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleAddChannel}
                        >
                            <Form.Item
                                name="projectId"
                                label="Project"
                                rules={[{ required: true, message: 'Please select a project' }]}
                            >
                                <Select 
                                    placeholder="Select a project"
                                    showSearch
                                    optionFilterProp="children"
                                >
                                    {projects.map(project => (
                                        <Select.Option key={project.id} value={project.id}>
                                            {project.name}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item
                                name="slackChannelId"
                                label="Slack Channel"
                                rules={[{ required: true, message: 'Please select a Slack channel' }]}
                            >
                                <Select 
                                    placeholder="Select a Slack channel"
                                    showSearch
                                    optionFilterProp="children"
                                >
                                    {availableChannels.map(channel => (
                                        <Select.Option key={channel.id} value={channel.id}>
                                            {channel.is_private && '🔒 '} #{channel.name}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item
                                name="notificationTypes"
                                label="Notification Types"
                                rules={[{ required: true }]}
                            >
                                <Select
                                    mode="multiple"
                                    placeholder="Select notification types"
                                    options={[
                                        { value: 'task_created', label: 'Task Created' },
                                        { value: 'task_completed', label: 'Task Completed' },
                                        { value: 'task_assigned', label: 'Task Assigned' },
                                        { value: 'comment_added', label: 'Comment Added' },
                                        { value: 'due_date_reminder', label: 'Due Date Reminder' }
                                    ]}
                                />
                            </Form.Item>

                            <Form.Item>
                                <Button type="primary" htmlType="submit" block>
                                    Add Configuration
                                </Button>
                            </Form.Item>
                        </Form>
                    </Modal>
                </>
            ) : (
                <div className="text-center py-8">
                    <SlackOutlined className="text-6xl text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Connect Your Slack Workspace</h3>
                    <p className="text-gray-500 mb-6 max-w-md mx-auto">
                        Integrate Slack with your Worklenz team to receive real-time notifications, 
                        create tasks from Slack, and keep your team synchronized across both platforms.
                    </p>
                    <div className="space-y-4 max-w-md mx-auto text-left mb-6">
                        <div className="flex items-start gap-3">
                            <CheckCircleOutlined className="text-green-500 mt-1" />
                            <div>
                                <strong>Real-time Notifications</strong>
                                <p className="text-sm text-gray-500">Get notified about task updates, comments, and deadlines</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircleOutlined className="text-green-500 mt-1" />
                            <div>
                                <strong>Create Tasks from Slack</strong>
                                <p className="text-sm text-gray-500">Use slash commands to quickly create tasks without leaving Slack</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircleOutlined className="text-green-500 mt-1" />
                            <div>
                                <strong>Team Collaboration</strong>
                                <p className="text-sm text-gray-500">Keep your entire team in sync across Worklenz and Slack</p>
                            </div>
                        </div>
                    </div>
                    <Button 
                        type="primary" 
                        size="large" 
                        onClick={handleConnect}
                        loading={loading}
                    >
                        Connect Slack Workspace
                    </Button>
                </div>
            )}
        </Card>
    );
}
```

## Testing

### 1. Local Testing with ngrok
```bash
# Install ngrok
npm install -g ngrok

# Start your backend server
npm run dev

# In another terminal, expose your local server
ngrok http 3000

# Use the ngrok URL for Slack app configuration
```

### 2. Test Cases
- [ ] OAuth flow completes successfully
- [ ] Slash commands create tasks
- [ ] Notifications are sent for configured events
- [ ] Channel configurations can be added/removed
- [ ] Disconnecting removes all configurations
- [ ] Error handling for API failures
- [ ] Rate limiting is respected

## Multi-Tenant Architecture Benefits

1. **Independent Workspaces**: Each Worklenz team connects their own Slack workspace
2. **Isolated Data**: Team configurations and data are completely isolated
3. **Flexible Configuration**: Each team can configure their own notification preferences
4. **Scalability**: Single app scales to support unlimited teams
5. **Easy Management**: Teams can connect/disconnect at any time

## User Flow

1. **Team Admin initiates connection** from Worklenz settings
2. **OAuth flow** opens in popup/new window
3. **User selects their Slack workspace** and authorizes the app
4. **Worklenz stores the connection** for that specific team
5. **Team configures channels** for each project
6. **Notifications flow automatically** based on configuration

## Deployment Checklist

### Backend
- [ ] Environment variables configured with Slack app credentials
- [ ] Database migrations run for Slack tables
- [ ] SSL certificates configured (required for Slack)
- [ ] Webhook endpoints accessible from internet
- [ ] Error logging and monitoring configured
- [ ] State encryption key configured

### Slack App Configuration
- [ ] OAuth redirect URLs configured for production
- [ ] Event subscription URL verified
- [ ] Slash command URLs configured
- [ ] Request URL for interactivity configured
- [ ] App home page configured (optional)
- [ ] App distributed to Slack App Directory (optional)

### Security
- [ ] Request signature verification implemented
- [ ] OAuth state parameter encryption
- [ ] Bot tokens encrypted in database
- [ ] Rate limiting on all endpoints
- [ ] CSRF protection on forms
- [ ] Monitoring for suspicious activity

## Next Steps for MS Teams & GitHub

### MS Teams Integration (Similar Multi-Tenant Approach)
1. **Azure AD App Registration**
   - Register single app in Azure AD
   - Configure multi-tenant access
   - Set up Bot Framework

2. **Key Differences from Slack**
   - Uses Microsoft Graph API
   - Adaptive Cards instead of Block Kit
   - Teams/Channels structure differs from Slack
   - Requires Azure AD consent flow

3. **Implementation Path**
   - Reuse database structure (similar tables with `teams_` prefix)
   - Adapt notification service for Teams format
   - Use Bot Framework SDK for interactions

### GitHub Integration
1. **GitHub App Creation**
   - Create GitHub App (not OAuth App) for better permissions
   - Configure webhooks for repository events
   - Set up installation flow

2. **Key Features**
   - Sync GitHub issues with Worklenz tasks
   - Create tasks from pull requests
   - Update task status based on PR merges
   - Comment synchronization

3. **Multi-Tenant Approach**
   - Each team installs the GitHub App to their repositories
   - Map GitHub organizations to Worklenz teams
   - Store installation tokens per team

### Common Integration Framework
```typescript
// Abstract interface for all integrations
interface IntegrationProvider {
    connect(teamId: string): Promise<void>;
    disconnect(teamId: string): Promise<void>;
    sendNotification(config: NotificationConfig): Promise<void>;
    getChannels(teamId: string): Promise<Channel[]>;
    handleWebhook(payload: any): Promise<void>;
}

// Shared notification types
enum NotificationType {
    TASK_CREATED = 'task_created',
    TASK_COMPLETED = 'task_completed',
    TASK_ASSIGNED = 'task_assigned',
    COMMENT_ADDED = 'comment_added',
    DUE_DATE_REMINDER = 'due_date_reminder'
}

// Unified settings UI can handle all integrations
```

## Resources

- [Slack API Documentation](https://api.slack.com)
- [Slack SDK for Node.js](https://slack.dev/node-slack-sdk/)
- [Block Kit Builder](https://app.slack.com/block-kit-builder)
- [OAuth 2.0 Flow](https://api.slack.com/authentication/oauth-v2)
- [Events API](https://api.slack.com/events-api)

## Support

For questions or issues with the integration:
1. Check Slack API status: https://status.slack.com
2. Review error logs in `slack_notifications` table
3. Test with Slack's API tester
4. Contact the development team lead