create table if not exists users (
  id          bigint primary key,            -- Telegram user id
  username    text,
  first_name  text,
  balance     bigint not null default 0 check (balance >= 0),  -- in Stars
  round_count int    not null default 0,     -- provably-fair nonce
  banned      boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists transactions (
  id            bigserial primary key,
  user_id       bigint not null references users(id),
  kind          text   not null,             -- deposit | deposit_refund | bet | payout | bonus | withdraw | withdraw_refund | gift_withdraw | gift_refund
  amount        bigint not null,             -- signed
  balance_after bigint not null,
  ref           text,
  created_at    timestamptz not null default now()
);
-- idempotency: the same Telegram payment can never be credited twice
create unique index if not exists transactions_kind_ref on transactions(kind, ref) where ref is not null;
create index if not exists transactions_user on transactions(user_id, id desc);

create table if not exists rounds (
  id               bigserial primary key,
  user_id          bigint not null references users(id),
  game             text   not null,
  bet              bigint not null,
  status           text   not null default 'active',  -- active | won | lost
  multiplier       numeric not null default 1,
  payout           bigint not null default 0,
  state            jsonb  not null,                    -- secret until finished
  server_seed      text   not null,
  server_seed_hash text   not null,
  client_seed      text   not null,
  nonce            int    not null,
  created_at       timestamptz not null default now(),
  finished_at      timestamptz
);
create unique index if not exists rounds_one_active on rounds(user_id, game) where status = 'active';
create index if not exists rounds_user on rounds(user_id, id desc);

create table if not exists withdrawals (
  id         bigserial primary key,
  user_id    bigint not null references users(id),
  amount     bigint not null check (amount > 0),
  status     text   not null default 'pending',  -- pending | approved | rejected
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table users add column if not exists last_daily timestamptz;

-- Telegram gifts won in the daily chest; an admin sends them (/gifts, /sent <id>)
create table if not exists user_gifts (
  id         bigserial primary key,
  user_id    bigint not null references users(id),
  gift       text   not null,
  status     text   not null default 'pending',   -- pending | sent
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);

-- Visual-only gifts (personal mode): PampGram polls these and draws them locally; nothing is sent via Telegram
create table if not exists visual_gifts (
  id           bigserial primary key,
  user_id      bigint not null references users(id),
  gift_id      text   not null,
  text         text,
  deliver_at   timestamptz not null,
  delivered_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists visual_gifts_pending on visual_gifts(user_id, deliver_at) where delivered_at is null;
