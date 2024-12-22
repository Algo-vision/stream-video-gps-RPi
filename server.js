const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 80 });

const clients = new Map();

wss.on("connection", (ws) => {
  console.log("Connected client");
  ws.on("message", (message) => {
    console.log("Received msg: "+ message);
    console.log(typeof message)
    const data = JSON.parse(message);

    if (data.type === "register") {
      clients.set(data.id, ws);
      console.log("Registering:" + data.id);
      console.log(clients);
      console.log(clients.get('python-provider'));
      console.log(clients.get('html-client'));
      ws.send(JSON.stringify({registered:true}));
    } else if (data.type === "signal") {
      console.log("target_id: "+data.targetId);
      const target = clients.get(data.targetId);
      console.log("type:" + data.type);
      console.log("target:"+target);
      if (target) {
        target.send(JSON.stringify(data));
      }
    }
  });

  ws.on("close", () => {
    for (const [id, client] of clients.entries()) {
      if (client === ws) {
        clients.delete(id);
        break;
      }
    }
  });
});

console.log("Signaling server running on ws://localhost:9000");