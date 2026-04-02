import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());

const CLIENT_ID = process.env.CLIENT_ID!;
const CLIENT_SECRET = process.env.CLIENT_SECRET!;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN!;

const BASIC = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

let accessToken: string | null = null;
let tokenExpiresAt = 0;

// ───────────────────────────────────────────────────────────
//  ACCESS TOKEN
// ───────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
    const now = Date.now();

    if (accessToken && now < tokenExpiresAt) {
        return accessToken;
    }

    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${BASIC}`,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `grant_type=refresh_token&refresh_token=${REFRESH_TOKEN}`
    });

    const data = await response.json() as { access_token: string; expires_in: number };

    accessToken = data.access_token;
    tokenExpiresAt = now + data.expires_in * 1000 - 5000;

    return accessToken;
}

// ───────────────────────────────────────────────────────────
//  SPOTIFY REQUEST WRAPPER
// ───────────────────────────────────────────────────────────

async function spotifyRequest(endpoint: string) {
    const token = await getAccessToken();

    const response = await fetch(`https://api.spotify.com/v1/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 429) {
        const retry = response.headers.get("Retry-After");
        throw new Error(`Rate limited. Retry after ${retry} seconds.`);
    }

    const text = await response.text();

    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`Spotify returned non-JSON: ${text}`);
    }
}

// ───────────────────────────────────────────────────────────
//  ROUTES
// ───────────────────────────────────────────────────────────

app.get("/user", async (_req, res) => {
    try {
        const user = await spotifyRequest("me");
        res.json(user);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});

app.get("/now-playing", async (_req, res) => {
    try {
        const token = await getAccessToken();
        const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (response.status === 204) {
            return res.json({ playing: false, track: null });
        }

        const data = await response.json();
        res.json(data);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});

app.get("/top-tracks", async (_req, res) => {
    try {
        const shortTerm = await spotifyRequest("me/top/tracks?time_range=short_term");
        const mediumTerm = await spotifyRequest("me/top/tracks?time_range=medium_term");
        const longTerm = await spotifyRequest("me/top/tracks?time_range=long_term");

        res.json({
            short_term: shortTerm.items,
            medium_term: mediumTerm.items,
            long_term: longTerm.items
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});

app.get("/top-artists", async (_req, res) => {
    try {
        const shortTerm = await spotifyRequest("me/top/artists?time_range=short_term");
        const mediumTerm = await spotifyRequest("me/top/artists?time_range=medium_term");
        const longTerm = await spotifyRequest("me/top/artists?time_range=long_term");

        res.json({
            short_term: shortTerm.items,
            medium_term: mediumTerm.items,
            long_term: longTerm.items
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: message });
    }
});

// ───────────────────────────────────────────────────────────
//  SERVER
// ───────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
