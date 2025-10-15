import index from "./index.html";
import { join } from "node:path";

const PROJECT_ROOT = import.meta.dir;

const server = Bun.serve({
  routes: {
    "/": index,

    "/api/videos": {
      async GET() {
        return Response.json({
          videos: [
            {
              id: "1",
              title: "Introduction to React",
              thumbnail: "https://via.placeholder.com/300x200/4a90e2/ffffff?text=React+Intro",
              duration: "10:24",
              uploadDate: "2025-10-01",
              views: 1234,
            },
            {
              id: "2",
              title: "Building with Bun",
              thumbnail: "https://via.placeholder.com/300x200/f39c12/ffffff?text=Bun+Tutorial",
              duration: "15:30",
              uploadDate: "2025-10-05",
              views: 856,
            },
          ],
        });
      },
      async POST(req) {
        const body = await req.json();
        return Response.json({
          success: true,
          video: {
            id: Date.now().toString(),
            ...body,
          },
        });
      },
    },
  },

  development: {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Video Management Service running at ${server.url}`);
