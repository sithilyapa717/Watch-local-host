export const LIBRARY_UPDATED = "watch:library-updated";
export const NEW_FILES_EVENT = "watch:new-files";

export function notifyLibraryUpdated() {
  window.dispatchEvent(new CustomEvent(LIBRARY_UPDATED));
}

export function notifyNewFiles(files: unknown[]) {
  window.dispatchEvent(new CustomEvent(NEW_FILES_EVENT, { detail: files }));
}
