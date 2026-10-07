export function register() {
  // Vercel runs server code in UTC, but every page here (calendar times, month
  // grids, "today", deadlines) is computed with local-time Date methods and
  // meant for a Korean team. Pin the process to KST so production renders the
  // same as local dev. Node picks up a runtime TZ change immediately.
  // (TZ is a reserved env var on Vercel, so it can't be set in project settings.)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = "Asia/Seoul";
  }
}
