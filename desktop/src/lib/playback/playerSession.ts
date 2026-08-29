export type PlayerMode = "mpv" | "embedded";

export interface SubtitleTrack {
  label: string;
  path: string;
  format: string;
}

export interface PlayerSession {
  fileId: number;
  path: string;
  title: string;
  startSec: number;
  mode: PlayerMode;
  subtitles: SubtitleTrack[];
}

let session: PlayerSession | null = null;

export function setPlayerSession(next: PlayerSession) {
  session = next;
}

export function getPlayerSession(): PlayerSession | null {
  return session;
}

export function clearPlayerSession() {
  session = null;
}
