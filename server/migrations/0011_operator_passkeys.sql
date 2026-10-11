-- Llaves de acceso del operador (huella, cara o PIN del celular o la compu). Se suman con la sesión
-- abierta y un código nuevo del autenticador; después alcanzan para entrar al panel. Quedan atadas a
-- la configuración del operador: si cambian el email, la clave o el TOTP, dejan de servir.
create table operator_passkeys (
  credential_id text primary key,  -- base64url
  config_hash text not null,
  public_key text not null,        -- COSE, base64url
  counter integer not null,
  transports text,
  name text,
  created_at integer not null,
  last_used_at integer
);

-- Desafíos de WebAuthn: de un solo uso, cinco minutos. La cookie lleva el token; acá, su hash.
create table operator_challenges (
  token_hash text primary key,
  purpose text not null check (purpose in ('register', 'login')),
  challenge text not null,
  config_hash text not null,
  expires_at integer not null
);
