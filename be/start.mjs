// Peluncur untuk pm2 mode cluster: memuat tsx lalu server TypeScript.
import { register } from "tsx/esm/api";

register();
await import("./src/server.ts");
