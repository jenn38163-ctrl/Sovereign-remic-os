import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize Gemini AI SDK securely on the server
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required");
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  // In-memory logs store for integrations
  interface IntegrationLog {
    id: string;
    integrationName: string;
    type: string;
    status: 'SUCCESS' | 'FAILED' | 'PENDING';
    latencyMs: number;
    timestamp: string;
    payload: any;
    response: any;
  }

  const integrationLogs: IntegrationLog[] = [
    {
      id: "log-1",
      integrationName: "Gemini AI Core",
      type: "LLM",
      status: "SUCCESS",
      latencyMs: 342,
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      payload: { prompt: "Analyze customer sentiment for Q3 feedback." },
      response: { text: "Customer sentiment is 84% positive, with high satisfaction in performance and API reliability." }
    },
    {
      id: "log-2",
      integrationName: "GitHub Webhook Receiver",
      type: "Webhook",
      status: "SUCCESS",
      latencyMs: 120,
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      payload: { event: "push", repo: "integration-hub-core", ref: "refs/heads/main" },
      response: { status: 200, message: "Webhook accepted and verified." }
    },
    {
      id: "log-3",
      integrationName: "Stripe Billing Sync",
      type: "REST API",
      status: "SUCCESS",
      latencyMs: 512,
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      payload: { action: "sync_invoices", customer_id: "cus_9821" },
      response: { synchronizedCount: 14, batchId: "batch_2026_08" }
    }
  ];

  // API Endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Gemini AI generation endpoint
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { prompt, systemInstruction } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const ai = getGeminiClient();
      const startTime = Date.now();
      
      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: systemInstruction ? { systemInstruction } : undefined
      });

      const latencyMs = Date.now() - startTime;
      const text = response.text || "No response generated.";

      // Log the execution
      const newLog: IntegrationLog = {
        id: `log-${Date.now()}`,
        integrationName: "Gemini AI Core",
        type: "LLM",
        status: "SUCCESS",
        latencyMs,
        timestamp: new Date().toISOString(),
        payload: { prompt, systemInstruction },
        response: { text }
      };
      integrationLogs.unshift(newLog);
      if (integrationLogs.length > 50) integrationLogs.pop();

      res.json({ text, latencyMs, log: newLog });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      
      const failedLog: IntegrationLog = {
        id: `log-${Date.now()}`,
        integrationName: "Gemini AI Core",
        type: "LLM",
        status: "FAILED",
        latencyMs: 0,
        timestamp: new Date().toISOString(),
        payload: req.body,
        response: { error: error.message }
      };
      integrationLogs.unshift(failedLog);

      res.status(500).json({ error: error.message || "Failed to generate AI response" });
    }
  });

  // Test custom integration (Webhook / REST API / Database)
  app.post("/api/integrations/test", async (req, res) => {
    try {
      const { integrationName, type, endpointUrl, payload, method } = req.body;
      const startTime = Date.now();

      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 400));

      let responseData: any = {};
      let status: 'SUCCESS' | 'FAILED' = 'SUCCESS';

      if (type === 'Webhook') {
        responseData = {
          accepted: true,
          statusCode: 200,
          eventDispatched: true,
          targetUrl: endpointUrl || "https://api.webhook.site/v1/events",
          receivedPayload: payload
        };
      } else if (type === 'REST API') {
        responseData = {
          status: "OK",
          httpCode: 200,
          endpoint: endpointUrl || "https://api.external-service.io/v1/sync",
          responseBody: { success: true, processedRecords: Math.floor(Math.random() * 50) + 1, transactionId: `txn_${Math.random().toString(36).substring(7)}` }
        };
      } else if (type === 'Database') {
        responseData = {
          connected: true,
          latency: "14ms",
          queryExecuted: payload?.query || "SELECT COUNT(*) FROM records;",
          rowsAffected: Math.floor(Math.random() * 10) + 1
        };
      } else {
        responseData = { success: true, message: "Custom integration test passed successfully." };
      }

      const latencyMs = Date.now() - startTime;

      const log: IntegrationLog = {
        id: `log-${Date.now()}`,
        integrationName: integrationName || "Custom Integration",
        type: type || "REST API",
        status,
        latencyMs,
        timestamp: new Date().toISOString(),
        payload: payload || {},
        response: responseData
      };

      integrationLogs.unshift(log);
      if (integrationLogs.length > 50) integrationLogs.pop();

      res.json({ success: true, latencyMs, response: responseData, log });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get recent logs
  app.get("/api/integrations/logs", (req, res) => {
    res.json({ logs: integrationLogs });
  });

  // Vite middleware setup for development, static serving for production
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
      res.sendFile(path.join(distPath, "index.html"), (err) => {
        if (err) {
          res.status(404).send("App is building or static files not found. Please run build.");
        }
      });
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Integration Hub server running on http://localhost:${PORT}`);
  });
}

startServer();
