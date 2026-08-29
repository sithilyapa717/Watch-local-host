import type { NavigateFunction } from "react-router-dom";
import { api } from "@/lib/api/tauri";
import { setPlayerSession } from "@/lib/playback/playerSession";

export async function playAndNavigate(
  navigate: NavigateFunction,
  fileId: number,
  path: string,
  title: string,
  subtitle?: string,
  startOver = false,
): Promise<void> {
  const status = await api.playMedia(fileId, path, title, subtitle, startOver);
  setPlayerSession({
    fileId,
    path: status.path,
    title: status.title,
    startSec: status.start_sec,
    mode: status.mode,
    subtitles: status.subtitles ?? [],
  });
  navigate("/player");
}
