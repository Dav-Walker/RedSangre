# RedSangre

## Supabase authentication

The login page uses Supabase email/password authentication. Copy `.env.example` to
`.env` and set the project URL and publishable key from your Supabase project settings:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

Only use a Supabase publishable key (or legacy anon key) in this browser app. Never
put a service-role or secret key in a `VITE_` variable. The `.env` file is ignored
by Git. Restart the Vite dev server after changing environment variables.

Users must already exist in Supabase Auth with email/password enabled. Authenticated
users can access the app routes; signing out returns to the login page.

## Development

```sh
npm install
npm run dev
```

Run `npm run build` to type-check and build the app, or `npm run lint` to run ESLint.

This app uses React, TypeScript, Vite, and `@vitejs/plugin-react`.
