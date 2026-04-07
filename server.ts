import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API route to list CSV files in the public folder
  app.get("/api/csv-files", (req, res) => {
    const publicPath = path.join(__dirname, "public");
    try {
      if (!fs.existsSync(publicPath)) {
        return res.json([]);
      }
      const files = fs.readdirSync(publicPath);
      const csvFiles = files.filter(file => file.toLowerCase().endsWith(".csv"));
      res.json(csvFiles);
    } catch (error) {
      console.error("Error reading public directory:", error);
      res.status(500).json({ error: "Failed to list files" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
