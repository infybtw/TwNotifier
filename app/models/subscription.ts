interface TwitchEventSubTransport {
  method: "webhook" | "websocket" | "conduit";
  callback?: string;
  session_id?: string;
  connected_at?: string;
  disconnected_at?: string;
  conduit_id?: string;
}

interface TwitchEventSubCondition {
  broadcaster_user_id?: string;
  moderator_user_id?: string;
  user_id?: string;
  [key: string]: string | undefined;
}

interface TwitchEventSubSubscription {
  id: string;
  status:
    | "enabled"
    | "webhook_callback_verification_pending"
    | "webhook_callback_verification_failed"
    | "notification_failures_exceeded"
    | "authorization_revoked"
    | "moderator_removed"
    | "user_removed"
    | "chat_user_banned"
    | "version_removed"
    | "beta_maintenance"
    | "websocket_disconnected"
    | "websocket_failed_ping_pong"
    | "websocket_received_inbound_traffic"
    | "websocket_connection_unused"
    | "websocket_internal_error"
    | "websocket_network_timeout"
    | "websocket_network_error";
  type: string;
  version: string;
  condition: TwitchEventSubCondition;
  created_at: string;
  transport: TwitchEventSubTransport;
  cost: number;
}

interface TwitchGetEventSubSubscriptionsResponse {
  data: TwitchEventSubSubscription[];
  total: number;
  total_cost: number;
  max_total_cost: number;
  pagination: {
    cursor?: string;
  };
}
