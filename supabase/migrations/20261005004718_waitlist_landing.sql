-- 待機リストは認証アカウントと分離し、アプリサーバーだけが操作する。
CREATE TABLE public.t_waitlist_entry (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT t_waitlist_entry_pkey PRIMARY KEY (id),
  CONSTRAINT t_waitlist_entry_email_normalized CHECK (email = lower(btrim(email)))
);
CREATE UNIQUE INDEX t_waitlist_entry_email_key ON public.t_waitlist_entry(email);

CREATE TABLE public.t_waitlist_rate_limit (
  key VARCHAR(64) NOT NULL,
  window_start TIMESTAMPTZ(6) NOT NULL,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0),
  CONSTRAINT t_waitlist_rate_limit_pkey PRIMARY KEY (key, window_start)
);
CREATE INDEX t_waitlist_rate_limit_expires_at_idx ON public.t_waitlist_rate_limit(expires_at);

ALTER TABLE public.t_waitlist_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_waitlist_rate_limit ENABLE ROW LEVEL SECURITY;
-- Supabaseの既定権限に依存せず、ブラウザーのanon/authenticatedから読み書きできなくする。
REVOKE ALL ON public.t_waitlist_entry, public.t_waitlist_rate_limit FROM PUBLIC, anon, authenticated;
