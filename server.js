const express = require("express");
const bodyParser = require("body-parser");
const cors = require('cors')
const app = express();
app.use(bodyParser.json());
app.use(cors())

const messages = {}; // Store messages for each client

// Endpoint to send messages
app.post("/send", (req, res) => {
  const { to, message } = req.body;
  if (!messages[to]) messages[to] = [];
  messages[to].push(message);
  res.sendStatus(200);
});

// Endpoint to receive messages
app.get("/receive/:clientId", (req, res) => {
  const clientId = req.params.clientId;
  const clientMessages = messages[clientId] || [];
  messages[clientId] = []; // Clear messages after sending
  res.json(clientMessages);
});

// Start the server
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => console.log(`Signaling server running on port ${PORT}`));