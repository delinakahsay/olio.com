# Olio

## Database setup
This project now supports a Supabase backend for persistent user/profile storage.

### Environment variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

If these are set, API requests will use Supabase for users, saved items, and orders.
If not set, the app falls back to local storage in `data/users.json` for development.

### Recommended Supabase schema
Run this SQL in your Supabase project:

```sql
create table users (
  id uuid primary key,
  email text unique not null,
  passwordHash text not null,
  salt text not null,
  token text,
  savedItems jsonb default '[]',
  orders jsonb default '[]',
  createdAt timestamptz default now()
);
```

### Notes
- The current auth flow uses email/password hashing and a server-generated token.
- For real multi-user persistence in production, set up Supabase and deploy with the env vars above.
