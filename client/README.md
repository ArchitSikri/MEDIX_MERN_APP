# Medix

## Run locally

1. Configure `server/.env` with `MONGO_URL` and `JWT_SECRET`.
2. Set `VITE_GOOGLE_CLIENT_ID` in `client/.env` to enable Google sign-in for user login and registration. Configure `GOOGLE_CLIENT_ID` on the server to the same OAuth client ID. Configure `GOOGLE_USER`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN` for email verification. Doctor registration and user profile-image uploads also require `IMAGEKIT_PRIVATE_KEY`.
3. Start the API with `npm run dev` from `server/`.
4. Start the client with `npm run dev` from `client/`. Vite proxies `/api` requests to `http://localhost:3000`.

For a separately hosted API, set `VITE_API_URL` in the client environment and set `CLIENT_ORIGIN` in the server environment to the frontend origin. `CLIENT_ORIGIN` accepts a comma-separated list.

User and doctor registrations require email OTP verification. Doctors can sign in only after their email has been verified and an administrator has approved their profile.
