import express from "express";
import WebSocket, { WebSocketServer } from "ws";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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
 * Twilio webhook – MUST return TwiML
 */
app.post("/voice", (req, res) => {
  const streamUrl = `${PUBLIC_URL.replace(/\/$/, "")}/twilio-stream`
    .replace("https://", "wss://");

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>One moment please.</Say>
  <Start>
    <Stream url="${streamUrl}" />
  </Start>
  <Pause length="60" />
</Response>`;

  res.type("text/xml").send(twiml);
});

const server = app.listen(PORT, () =>
  console.log(`Listening on ${PORT}`)
);

/**
 * WebSocket server for Twilio Media Streams
 */
const wss = new WebSocketServer({ server, path: "/twilio-stream" });

wss.on("connection", (twilioWs) => {
  console.log("Twilio connected");

  let streamSid;
  let openaiWs;

  const connectOpenAI = () => {
    openaiWs = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${MODEL}`,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1"
        }
      }
    );

    openaiWs.on("open", () => {
      console.log("OpenAI connected");

      openaiWs.send(JSON.stringify({
        type: "session.update",
        session: {
          voice: VOICE,
          instructions:
            "You are a friendly, professional phone assistant. Speak naturally. Keep responses short. Ask one question at a time.",
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          turn_detection: { type: "server_vad" },
          max_response_output_tokens: 200
        }
      }));

      openaiWs.send(JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["audio"],
          instructions:
            "Hi, thanks for calling. How can I help you today?"
        }
      }));
    });

    openaiWs.on("message", (data) => {
      const msg = JSON.parse(data.toString());

      if (msg.type === "response.audio.delta" && streamSid) {
        twilioWs.send(JSON.stringify({
          event: "media",
          streamSid,
          media: { payload: msg.delta }
        }));
      }
    });
  };

  connectOpenAI();

  twilioWs.on("message", (data) => {
    const msg = JSON.parse(data.toString());

    if (msg.event === "start") {
      streamSid = msg.start.streamSid;
    }

    if (msg.event === "media" && openaiWs?.readyState === WebSocket.OPEN) {
      openaiWs.send(JSON.stringify({
        type: "input_audio_buffer.append",
        audio: msg.media.payload
      }));
    }

    if (msg.event === "stop") {
      openaiWs.close();
    }
  });

  twilioWs.on("close", () => openaiWs?.close());
});
