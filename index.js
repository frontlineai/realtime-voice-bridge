import express from "express";
import WebSocket, { WebSocketServer } from "ws";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ✅ Log every inbound HTTP request (critical for debugging Twilio)
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PUBLIC_URL = process.env.PUBLIC_URL;

if (!OPENAI_API_KEY || !PUBLIC_URL) {
  console.error("Missing OPENAI_API_KEY or PUBLIC_URL");
}

const VOICE = "alloy";
const MODEL = "gpt-realtime-mini";

// Health check
app.get("/", (req, res) => res.send("OK"));

/**
 * ✅ TEMPORARY: Twilio webhook (proof mode)
 * This confirms calls are routing to your Render service.
 * After this works, we'll switch back to the streaming TwiML.
 */
app.post("/voice", (req, res) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Webhook reached. Your call is connected.</Say>
  <Hangup/>
</Response>`;
  res.type("text/xml").send(twiml);
});

/**
 * (Optional) A GET /voice so you can test in browser quickly.
 */
app.get("/voice", (req, res) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Voice webhook reachable.</Say>
</Response>`;
  res.type("text/xml").send(twiml);
});

const server = app.listen(PORT, () => console.log(`Listening on ${PORT}`));

/**
 * WebSocket server for Twilio Media Streams
 * NOTE: In proof mode above, Twilio won't start streaming yet.
 * We'll re-enable streaming once routing is confirmed.
 */
const wss = new WebSocketServer({ server, path: "/twilio-stream" });

wss.on("connection", (twilioWs) => {
  console.log("Twilio connected (WebSocket)");

  let streamSid;
  let openaiWs;

  const connectOpenAI = () => {
    openaiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=${MODEL}`, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    });

    openaiWs.on("open", () => {
      console.log("OpenAI connected");

      openaiWs.send(
        JSON.stringify({
          type: "session.upd
