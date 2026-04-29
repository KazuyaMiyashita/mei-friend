import { Server } from "@hocuspocus/server";

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

const server = new Server({
  port,
  async onAuthenticate() {
    // In the future, we can add authentication logic here if needed.
    // Returning an empty object as the context for now.
    return {};
  },
  async onLoadDocument(data) {
    console.log(`[Room: ${data.documentName}] Document loaded/created.`);
  },
  async onConnect(data) {
    console.log(`[Room: ${data.documentName}] Client connected.`);
  },
  async onDisconnect(data) {
    console.log(`[Room: ${data.documentName}] Client disconnected.`);
  },
  async onStoreDocument(data) {
    console.log(`[Room: ${data.documentName}] Document state updated.`);
  },
  // We can add the Database extension here later for persistence.
  // see: https://tiptap.dev/docs/hocuspocus/extensions/database
});

server.listen().then(() => {
  console.log(`Collaborative server is running on port ${port}`);
  console.log(`Endpoint: ws://localhost:${port}`);
});
