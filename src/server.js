// src/server.js
import express from "express";
import { consultarVanti } from "./vantiBot.js";

const app = express();
app.use(express.json());

const API_KEY = process.env.API_KEY || "";
const PORT = process.env.PORT || 8080;
const DEFAULT_RETRIES = parseInt(process.env.RETRIES || "3", 10);

function auth(req, res, next) {
  const key = req.header("x-api-key") || req.query.api_key;
  if (!API_KEY) return res.status(500).json({ ok: false, error: "API no configurada (falta API_KEY)" });
  if (key !== API_KEY) return res.status(401).json({ ok: false, error: "Unauthorized" });
  next();
}

app.get("/", (_req, res) => res.json({ ok: true, name: "vanti-api", version: "1.0.0" }));
app.get("/health", (_req, res) => res.json({ ok: true }));

// GET /api/v1/vanti?cuenta=61489570
app.get("/api/v1/vanti", auth, async (req, res) => {
  const cuenta = (req.query.cuenta || "").trim();
  const retries = +req.query.retries || DEFAULT_RETRIES;

  if (!cuenta) return res.status(400).json({ ok: false, error: "Parámetro 'cuenta' requerido" });

  const result = await consultarVanti(cuenta, { retries });
  const status = result.ok ? 200 : 502;
  res.status(status).json(result);
});

// POST { "cuenta": "61489570", "retries": 3 }
app.post("/api/v1/vanti", auth, async (req, res) => {
  const cuenta = (req.body.cuenta || "").trim();
  const retries = +req.body.retries || DEFAULT_RETRIES;

  if (!cuenta) return res.status(400).json({ ok: false, error: "Body 'cuenta' requerido" });

  const result = await consultarVanti(cuenta, { retries });
  const status = result.ok ? 200 : 502;
  res.status(status).json(result);
});

app.listen(PORT, () => {
  console.log(`Vanti API escuchando en :${PORT}`);
});
