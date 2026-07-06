
-- Add per-item admin approval fields
ALTER TABLE dispenser_cycle_items
  ADD COLUMN IF NOT EXISTS result_attachment_url   TEXT,
  ADD COLUMN IF NOT EXISTS admin_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_full_name         TEXT,
  ADD COLUMN IF NOT EXISTS admin_comments          TEXT,
  ADD COLUMN IF NOT EXISTS admin_approved_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_signature_url     TEXT;

-- Index for quickly fetching items pending admin review
CREATE INDEX IF NOT EXISTS idx_dci_status ON dispenser_cycle_items(status);
