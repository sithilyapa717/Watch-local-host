export const SETUP_DONE_KEY = "watch-setup-done";

export function isSetupComplete() {
  try {
    return localStorage.getItem(SETUP_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSetupComplete() {
  localStorage.setItem(SETUP_DONE_KEY, "1");
}

export function clearSetupComplete() {
  localStorage.removeItem(SETUP_DONE_KEY);
}
