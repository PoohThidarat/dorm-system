import { createApp } from "./app";
import { env } from "./config/env";

// หน้าที่ของไฟล์: จุดเริ่มต้นของ Backend server
const app = createApp();

app.listen(env.port, () => {
  console.log(`🚀 Dorm System API running on http://localhost:${env.port}`);
});
