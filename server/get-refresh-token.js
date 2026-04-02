import express from "express";
import fetch from "node-fetch";
import open from "open";
import dotenv from "dotenv";

dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = "http://127.0.0.1:8080/callback";

const app = express();

app.get("/login", (_req, res) => {
    const scope = "user-read-private user-read-email user-top-read user-read-playback-state";
    const authURL =
        "https://accounts.spotify.com/authorize" +
        "?response_type=code" +
        "&client_id=" + CLIENT_ID +
        "&scope=" + encodeURIComponent(scope) +
        "&redirect_uri=" + encodeURIComponent(REDIRECT_URI);

    res.redirect(authURL);
});

app.get("/callback", async (req, res) => {
    const code = req.query.code;

    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
    });

    const data = await response.json();

    console.log("\nACCESS TOKEN\n", data.access_token);
    console.log("\nREFRESH TOKEN\n", data.refresh_token);

    res.send("Refresh token generated. Check your terminal.");
    process.exit(0);
});

app.listen(8080, () => {
    console.log("Go to: http://127.0.0.1:8080/login");
    open("http://127.0.0.1:8080/login");
});
