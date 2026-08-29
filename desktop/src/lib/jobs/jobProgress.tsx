import { listen } from "@tauri-apps/api/event";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface JobProgress {
  active: boolean;
  title: string;
  detail: string;
  current: number;
  total: number;
  downloadedBytes: number;
  totalBytes: number;
}

const idleJob: JobProgress = {
  active: false,
  title: "",
  detail: "",
  current: 0,
  total: 0,
  downloadedBytes: 0,
  totalBytes: 0,
};

const JobContext = createContext<JobProgress>(idleJob);

export function JobProgressProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<JobProgress>(idleJob);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<JobProgress>("job-progress", (event) => {
      const payload = event.payload;
      setJob({
        ...idleJob,
        ...payload,
        downloadedBytes: payload.downloadedBytes ?? 0,
        totalBytes: payload.totalBytes ?? 0,
      });
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const value = useMemo(() => job, [job]);
  return <JobContext.Provider value={value}>{children}</JobContext.Provider>;
}

export function useJobProgress() {
  return useContext(JobContext);
}
