-- Migration: Add notification system tables
-- This migration adds tables for the notification system including templates, preferences, and history

-- Create enum types for notifications
CREATE TYPE notification_type AS ENUM (
    'route_assigned', 
    'route_completed', 
    'route_delayed', 
    'route_cancelled',
    'inspector_location_update',
    'system_alert',
    'assignment_change',
    'incident_reported',
    'zone_boundary_update',
    'workload_warning',
    'maintenance_notice'
);

CREATE TYPE notification_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');
CREATE TYPE notification_channel AS ENUM ('websocket', 'email', 'push', 'sms');
CREATE TYPE recipient_type AS ENUM ('user', 'inspector', 'zone', 'all');

-- Notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type notification_type NOT NULL,
    name VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message_template TEXT NOT NULL,
    email_template TEXT,
    push_template TEXT,
    default_channels notification_channel[] DEFAULT '{}',
    default_priority notification_priority DEFAULT 'medium',
    is_active BOOLEAN DEFAULT true,
    variables TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(type, name)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type notification_type NOT NULL,
    priority notification_priority DEFAULT 'medium',
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    recipient_id VARCHAR(100) NOT NULL,
    recipient_type recipient_type NOT NULL,
    channels notification_channel[] DEFAULT '{}',
    status notification_status DEFAULT 'pending',
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notification_type notification_type NOT NULL,
    channels notification_channel[] DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT true,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, notification_type)
);

-- Notification history table for tracking delivery attempts
CREATE TABLE IF NOT EXISTS notification_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
    channel notification_channel NOT NULL,
    status notification_status NOT NULL,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    response_data JSONB DEFAULT '{}'
);

-- Device tokens table for push notifications
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, token)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, recipient_type);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_history_notification ON notification_history(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(is_active);

-- Add triggers for updated_at
CREATE TRIGGER update_notification_templates_updated_at 
    BEFORE UPDATE ON notification_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at 
    BEFORE UPDATE ON notifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at 
    BEFORE UPDATE ON notification_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default notification templates
INSERT INTO notification_templates (type, name, title, message_template, default_channels, default_priority, variables) VALUES
('route_assigned', 'Route Assignment', 'New Route Assigned', 'You have been assigned to route "{{routeName}}" in {{zoneName}}. Estimated duration: {{estimatedDuration}} minutes.', ARRAY['websocket', 'push'], 'medium', ARRAY['routeName', 'zoneName', 'estimatedDuration']),
('route_completed', 'Route Completion', 'Route Completed', 'Route "{{routeName}}" has been completed by {{inspectorName}}.', ARRAY['websocket'], 'low', ARRAY['routeName', 'inspectorName']),
('route_delayed', 'Route Delay Alert', 'Route Delay Detected', 'Route "{{routeName}}" is {{delayMinutes}} minutes behind schedule.', ARRAY['websocket', 'email'], 'high', ARRAY['routeName', 'delayMinutes', 'inspectorName']),
('route_cancelled', 'Route Cancellation', 'Route Cancelled', 'Route "{{routeName}}" has been cancelled. Reason: {{reason}}', ARRAY['websocket', 'push'], 'medium', ARRAY['routeName', 'reason']),
('system_alert', 'System Alert', 'System Alert', '{{alertMessage}}', ARRAY['websocket', 'email'], 'high', ARRAY['alertMessage', 'alertType']),
('assignment_change', 'Assignment Change', 'Route Reassignment', 'Route "{{routeName}}" has been reassigned from {{previousInspector}} to {{newInspector}}.', ARRAY['websocket'], 'medium', ARRAY['routeName', 'previousInspector', 'newInspector']),
('incident_reported', 'Incident Report', 'Incident Reported', 'An incident has been reported on route "{{routeName}}": {{incidentDescription}}', ARRAY['websocket', 'email'], 'high', ARRAY['routeName', 'incidentDescription', 'inspectorName']),
('workload_warning', 'Workload Warning', 'High Workload Alert', 'Inspector {{inspectorName}} has exceeded recommended workload ({{currentLoad}}/{{maxLoad}} routes).', ARRAY['websocket', 'email'], 'medium', ARRAY['inspectorName', 'currentLoad', 'maxLoad']);

-- Insert default notification preferences for existing users (if any)
-- This will be handled by the application when users are created

-- Create function to automatically create default preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $
BEGIN
    -- Insert default preferences for all notification types
    INSERT INTO notification_preferences (user_id, notification_type, channels, is_enabled)
    SELECT 
        NEW.id,
        unnest(enum_range(NULL::notification_type)),
        CASE 
            WHEN NEW.role = 'admin' THEN ARRAY['websocket', 'email']::notification_channel[]
            WHEN NEW.role = 'supervisor' THEN ARRAY['websocket', 'email']::notification_channel[]
            WHEN NEW.role = 'inspector' THEN ARRAY['websocket', 'push']::notification_channel[]
            ELSE ARRAY['websocket']::notification_channel[]
        END,
        true;
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Create trigger to automatically create notification preferences for new users
CREATE TRIGGER trigger_create_default_notification_preferences
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_preferences();