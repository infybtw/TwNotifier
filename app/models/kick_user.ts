interface KickCategory {
  id: number;
  name: string;
  thumbnail: string;
}

interface KickStream {
  custom_tags: string[];
  is_live: boolean;
  is_mature: boolean;
  key: string;
  language: string;
  start_time: string;
  thumbnail: string;
  url: string;
  viewer_count: number;
}

interface KickChannel {
  active_subscribers_count: number;
  banner_picture: string;
  broadcaster_user_id: number;
  canceled_subscribers_count: number;
  category: KickCategory;
  channel_description: string;
  slug: string;
  stream: KickStream;
  stream_title: string;
}

interface KickChannelResponse {
  data: KickChannel[];
  message: string;
}
