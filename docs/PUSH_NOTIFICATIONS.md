# Push Notifications Implementation

## Overview

The Route Assignment System includes a comprehensive push notification system that supports:
- **Firebase Cloud Messaging (FCM)** for Android and Web Push notifications
- **Apple Push Notification Service (APNS)** for iOS notifications
- Device token management and registration
- Notification preferences and analytics
- Retry logic and error handling

## Features Implemented

### ✅ Core Components

1. **PushNotificationService** - Main service handling all push notification operations
2. **DeviceTokenRepository** - Database operations for device token management
3. **Push Notification Routes** - REST API endpoints for notification management
4. **Database Schema** - Tables for device tokens and notification tracking

### ✅ Key Functionality

- **Device Token Registration**: Register/unregister device tokens for push notifications
- **Multi-platform Support**: iOS, Android, and Web Push notifications
- **Bulk Notifications**: Send notifications to multiple users efficiently
- **Notification Preferences**: User-configurable notification settings
- **Analytics and Statistics**: Track delivery rates and platform usage
- **Token Cleanup**: Automatic cleanup of inactive device tokens
- **Error Handling**: Robust error handling with retry logic

### ✅ API Endpoints

- `POST /api/v1/push/tokens` - Register device token
- `DELETE /api/v1/push/tokens/:token` - Unregister device token
- `GET /api/v1/push/tokens` - Get user's device tokens
- `POST /api/v1/push/send` - Send push notifications (admin/supervisor only)
- `GET /api/v1/push/preferences` - Get notification preferences
- `PUT /api/v1/push/preferences` - Update notification preferences
- `GET /api/v1/push/statistics` - Get push notification statistics (admin only)
- `POST /api/v1/push/test` - Send test notification (admin only)
- `POST /api/v1/push/cleanup` - Cleanup inactive tokens (admin only)

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# FCM Configuration
FCM_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
FCM_PROJECT_ID=your-firebase-project-id

# APNS Configuration
APNS_KEY_ID=your-apns-key-id
APNS_TEAM_ID=your-apns-team-id
APNS_KEY_PATH=./config/AuthKey_XXXXXXXXXX.p8
APNS_BUNDLE_ID=com.yourcompany.routeassignment
APNS_PRODUCTION=false
```

### Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com/
2. Generate a service account key:
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save the JSON file as `firebase-service-account.json`
3. Enable Firebase Cloud Messaging in your project

### Apple Push Notifications Setup

1. Create an Apple Developer account
2. Generate an APNs Authentication Key:
   - Go to Certificates, Identifiers & Profiles
   - Keys > Create a key
   - Enable Apple Push Notifications service (APNs)
   - Download the .p8 file
3. Note your Team ID and Key ID

## Database Schema

The system uses the following database tables:

```sql
-- Device tokens for push notifications
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, token)
);

-- Indexes for performance
CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX idx_device_tokens_active ON device_tokens(is_active);
```

## Usage Examples

### Register Device Token

```javascript
// Frontend - Register device token
const response = await fetch('/api/v1/push/tokens', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    token: 'device-token-from-fcm-or-apns',
    platform: 'android' // or 'ios', 'web'
  })
});
```

### Send Push Notification

```javascript
// Backend - Send notification to users
const response = await fetch('/api/v1/push/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  },
  body: JSON.stringify({
    userIds: ['user-1', 'user-2'],
    title: 'Route Assigned',
    body: 'You have been assigned a new route',
    data: {
      routeId: 'route-123',
      type: 'route_assigned'
    },
    priority: 'high',
    platforms: ['android', 'ios']
  })
});
```

## Integration with Notification System

The push notification service integrates with the existing notification system:

1. **Real-time Notifications**: WebSocket notifications trigger push notifications for offline users
2. **Route Assignments**: Automatic push notifications when routes are assigned
3. **System Alerts**: Critical system alerts sent via push notifications
4. **Incident Reports**: Push notifications for incident reports and updates

## Testing

The implementation includes comprehensive tests:

- **Unit Tests**: Service logic and business rules
- **Integration Tests**: API endpoints and database operations
- **Mock Services**: Firebase and APNS mocking for testing

Run tests with:
```bash
npm test -- --testPathPattern="PushNotificationService|push-notifications"
```

## Security Considerations

- **Authentication**: All endpoints require valid JWT tokens
- **Authorization**: Admin/supervisor roles required for sending notifications
- **Token Validation**: Device tokens are validated and cleaned up regularly
- **Rate Limiting**: Built-in rate limiting for notification sending
- **Data Privacy**: User preferences respected for notification delivery

## Monitoring and Analytics

The system provides:

- **Delivery Statistics**: Track successful/failed deliveries
- **Platform Breakdown**: Analytics by device platform
- **Token Management**: Monitor active/inactive tokens
- **Error Tracking**: Comprehensive error logging and monitoring

## Future Enhancements

Potential improvements for the push notification system:

1. **Rich Notifications**: Support for images, actions, and rich content
2. **Scheduled Notifications**: Time-based notification scheduling
3. **Geofencing**: Location-based notification triggers
4. **A/B Testing**: Notification content testing and optimization
5. **Advanced Analytics**: Open rates, click-through rates, conversion tracking

## Troubleshooting

### Common Issues

1. **FCM Setup**: Ensure service account has proper permissions
2. **APNS Certificates**: Verify .p8 file and credentials are correct
3. **Token Registration**: Check device token format and platform
4. **Network Issues**: Verify firewall settings for FCM/APNS endpoints

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

This will provide detailed logs for notification sending and error handling.