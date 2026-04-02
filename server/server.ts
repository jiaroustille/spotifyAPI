import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());

// ───────────────────────────────────────────────────────────
//  CONFIG
// ───────────────────────────────────────────────────────────

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

const BASIC = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

// Cached token
let accessToken: null = null;
let tokenExpiresAt = 0;

// ───────────────────────────────────────────────────────────
//  TOKEN HANDLING
// ───────────────────────────────────────────────────────────

async function getAccessToken() {
    const now = Date.now();

    // Reuse token if still valid
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

    const data = await response.json();

    accessToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in * 1000) - 5000; // refresh 5s early

    return accessToken;
}

// ───────────────────────────────────────────────────────────
//  SPOTIFY REQUEST WRAPPER (handles 429 safely)
// ───────────────────────────────────────────────────────────

async function spotifyRequest(endpoint) {
    const token = await getAccessToken();

    const response = await fetch(`https://api.spotify.com/v1/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    // Handle rate limit
    if (response.status === 429) {
        const retry = response.headers.get("Retry-After");
        throw new Error(`Rate limited. Retry after ${retry} seconds.`);
    }

    // Handle non-JSON responses safely
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

// USER PROFILE
app.get("/user", async (req, res) => {
    try {
        const user = await spotifyRequest("me");
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// NOW PLAYING
app.get("/now-playing", async (req, res) => {
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
        res.status(500).json({ error: err.message });
    }
});

// TOP TRACKS
app.get("/top-tracks", async (req, res) => {
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
        res.status(500).json({ error: err.message });
    }
});

// TOP ARTISTS
app.get("/top-artists", async (req, res) => {
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
        res.status(500).json({ error: err.message });
    }
});

// ───────────────────────────────────────────────────────────
//  SERVER
// ───────────────────────────────────────────────────────────

app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
