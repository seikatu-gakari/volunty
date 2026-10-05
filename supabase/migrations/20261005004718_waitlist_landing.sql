-- 待機リストは認証アカウントと分離し、アプリサーバーだけが操作する。
CREATE TABLE public.t_waitlist_entry (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notified_at TIMESTAMPTZ(6),
  CONSTRAINT t_waitlist_entry_pkey PRIMARY KEY (id),
  CONSTRAINT t_waitlist_entry_email_normalized CHECK (email = lower(btrim(email)))
);
CREATE UNIQUE INDEX t_waitlist_entry_email_key ON public.t_waitlist_entry(email);

CREATE INDEX t_waitlist_entry_created_at_idx ON public.t_waitlist_entry(created_at);
CREATE INDEX t_waitlist_entry_notified_at_idx ON public.t_waitlist_entry(notified_at);

ALTER TABLE public.t_waitlist_entry ENABLE ROW LEVEL SECURITY;
-- Supabaseの既定権限に依存せず、ブラウザーのanon/authenticatedから読み書きできなくする。
REVOKE ALL ON public.t_waitlist_entry FROM PUBLIC, anon, authenticated;
