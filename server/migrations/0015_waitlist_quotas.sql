-- Lista de espera de la nube: quien quiere una casa en la nube y no tiene código deja su nombre y su
-- email. El operador lo habilita desde /admin cuando hay lugar: se crea su código y se le manda.
-- La fila se borra cuando crea la casa con ese código, o cuando el operador la borra.
create table cloud_waitlist (
  id text primary key,
  name text not null,
  email text not null unique,
  status text not null default 'waiting' check (status in ('waiting', 'enabled')),
  license_id text references cloud_licenses ("id") on delete set null,
  created_at integer not null,
  enabled_at integer
);

-- Topes por casa que el operador cambia desde /admin, sin deploy (ver server/src/quotas.ts).
-- Una sola fila con los de todas las casas. Sin fila, rigen los del código.
create table quota_defaults (
  id integer primary key check (id = 1),
  ops_per_day integer not null,
  log_bytes integer not null,
  photo_bytes integer not null,
  updated_at integer not null
);

-- El tope propio de una casa. Cada valor en null usa el de todas.
create table household_quotas (
  household_id text primary key references households ("id") on delete cascade,
  ops_per_day integer,
  log_bytes integer,
  photo_bytes integer,
  updated_at integer not null
);

-- La última vez que una casa llegó a cada tope, para verla en Capacidad.
create table quota_hits (
  household_id text not null references households ("id") on delete cascade,
  kind text not null check (kind in ('ops', 'log', 'photos')),
  at integer not null,
  primary key (household_id, kind)
);
