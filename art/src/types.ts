export type Day = {
  date: string;
  weekday: string;

  steps: number | null;

  temp_max_c: number | null;
  temp_min_c: number | null;
  temp_mean_c: number | null;
  precipitation_mm: number | null;
  rain_mm: number | null;
  snowfall_cm: number | null;
  wind_max_kmh: number | null;
  sunshine_hours: number | null;
  weather_code: number | null;
  weather_label: string | null;

  total_plays: number | null;
  minutes_listened: number | null;
  unique_artists: number | null;
  top_artist: string | null;
  top_album: string | null;
  album_signature_hex: string | null;
  late_night_streams: number | null;
  morning_streams: number | null;
  dominant_color_hex: string | null;

  screen_total_min: number | null;
  screen_productivity_min: number | null;
  screen_social_min: number | null;
  screen_entertainment_min: number | null;
  screen_other_min: number | null;
  screen_source: "real" | "mock" | null;
};

export type Dataset = {
  window: { start: string; end: string };
  days: Day[];
};
