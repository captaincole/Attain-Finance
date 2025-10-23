import { Router } from "express";
import { getVisualization } from "../storage/visualization/scripts.js";
import { logRouteEvent, serializeError } from "../utils/logger.js";

export function createVisualizationRouter() {
  const router = Router();

  router.get("/:userId", async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId parameter" });
    }

    try {
      const scriptContent = await getVisualization(userId);

      res.setHeader("Content-Type", "text/plain");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=visualize-spending.sh"
      );

      res.send(scriptContent);
    } catch (error: any) {
      logRouteEvent(
        "visualization-download",
        "error",
        { userId, error: serializeError(error) },
        "error"
      );
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
