import express from "express";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Log all incoming HTTP requests
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

const PORT = process.env.PORT || 3000;

// Health check
app.get("/", (req, res) => {
  res.send("OK");
});

// ✅ SIMPLE TWILIO TEST ENDPOINT
// This MUST work before anything fancy
app.post("/voice", (req, res) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Webhook reached. Your call is connected.</Say>
</Response>`;
  res.type("text/xml").send(twiml);
});

// Optional browser test
app.get("/voice", (req, res) => {
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Voice endpoint reachable.</Say>
</Response>`);
});

app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
