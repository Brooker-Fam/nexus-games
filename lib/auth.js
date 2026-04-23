import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins";
import { Pool } from "@neondatabase/serverless";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const auth = betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL || "https://www.nexusgames.space",
  secret: process.env.BETTER_AUTH_SECRET,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 365 * 10,
    updateAge: 60 * 60 * 24 * 30,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  plugins: [
    anonymous({
      emailDomainName: "anon.nexusgames.space",
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        const { getSql } = await import("./db.js");
        const sql = getSql();
        await sql`
          INSERT INTO game_stats (user_id, game_id, data, updated_at)
          SELECT ${newUser.user.id}, game_id, data, updated_at
          FROM game_stats
          WHERE user_id = ${anonymousUser.user.id}
          ON CONFLICT (user_id, game_id) DO UPDATE SET
            data = CASE
              WHEN game_stats.updated_at >= EXCLUDED.updated_at THEN game_stats.data
              ELSE EXCLUDED.data
            END,
            updated_at = GREATEST(game_stats.updated_at, EXCLUDED.updated_at)
        `;
        await sql`DELETE FROM game_stats WHERE user_id = ${anonymousUser.user.id}`;
      },
    }),
  ],
});
