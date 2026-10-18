// Writes to the append-only audit_events table.
// Pass the transaction client so the audit row commits (or rolls back) together with the change it describes.
export async function logAudit(db, { actorId, action, entityType, entityId, details, requestId }) {
  await db.query(
    `INSERT INTO audit_events (actor_id, action, entity_type, entity_id, details, request_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actorId ?? null, action, entityType, entityId ?? null, details ? JSON.stringify(details) : null, requestId ?? null],
  );
}
