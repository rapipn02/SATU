// pm2 di VPS 4 vCPU.
//  - satu-api : 4 proses (cluster). Aman: state ada di database; pool DB dibagi (DB_POOL_MAX=3 di .env).
//  - satu-ml  : SENGAJA 1 proses. Layanan ML menyimpan state tiap anak di memori; beberapa proses
//               akan memecah state itu dan membuat rekomendasi tidak konsisten. Bebannya ringan (I/O ke LLM).
// Jalankan:  pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: "satu-ml",
      cwd: "/www/wwwroot/satu/aisatu-main/backend",
      script: ".venv/bin/python",
      args: "-m uvicorn main:app --host 127.0.0.1 --port 7777", // hanya lokal, jangan dibuka ke internet
      interpreter: "none",
    },
    {
      name: "satu-api",
      cwd: "/www/wwwroot/satu/be",
      script: "start.mjs",
      exec_mode: "cluster",
      instances: 4,
      env: { NODE_ENV: "production", PORT: "3107" },
    },
  ],
};
