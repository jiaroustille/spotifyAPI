import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:8888/callback";

const CODE = "";

async function run() {
    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `grant_type=authorization_code&code=${CODE}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
    });

    const data = await response.json();
    console.log("\nACCESS TOKEN\n", data.access_token);
    console.log("\nREFRESH TOKEN\n", data.refresh_token);
}

run();
