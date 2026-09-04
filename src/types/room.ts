/**
 * The three ways a party game session can be hosted.
 *
 * - "single_device": everyone gathers around one screen and passes it around.
 * - "hotspot": devices join over a local WiFi/hotspot connection, no internet needed.
 * - "online": players join remotely over the internet via a hosted room.
 */
export type RoomMode = 'single_device' | 'hotspot' | 'online';

export interface RoomModeOption {
  mode: RoomMode;
  title: string;
  description: string;
}
