/**
 * Liveness probe for the deploy pipeline and uptime monitors: answers as soon
 * as the Node server is up. It does not touch the database, so a slow or
 * sleeping Neon compute never fails a deploy.
 */
export function GET() {
  return Response.json({ status: "ok" });
}
