import { logServiceEvent } from "../../utils/logger.js";

export interface DemoHomepageSection {
  title: string;
  description?: string;
  widget?: string;
}

export interface DemoHomepageRecord {
  userId: string;
  prompt: string;
  title: string;
  tools: string[];
  sections: DemoHomepageSection[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

const homepageStore = new Map<string, DemoHomepageRecord>();

interface SaveHomepageOptions {
  prompt: string;
  title?: string;
  tools?: string[];
  sections?: DemoHomepageSection[];
  notes?: string;
}

export function saveDemoHomepage(
  userId: string,
  options: SaveHomepageOptions
): DemoHomepageRecord {
  const nowIso = new Date().toISOString();
  const existing = homepageStore.get(userId);
  const record: DemoHomepageRecord = {
    userId,
    prompt: options.prompt.trim(),
    title: options.title?.trim() || existing?.title || "Financial Home",
    tools: Array.isArray(options.tools) && options.tools.length > 0
      ? Array.from(new Set(options.tools.map((tool) => tool.trim()).filter(Boolean)))
      : existing?.tools || [],
    sections:
      options.sections && options.sections.length > 0
        ? options.sections.map((section) => ({
            title: section.title.trim(),
            description: section.description?.trim(),
            widget: section.widget?.trim(),
          }))
        : existing?.sections || [],
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
    notes: options.notes?.trim() || existing?.notes,
  };

  homepageStore.set(userId, record);
  logServiceEvent("demo-homepage", "save", {
    userId,
    sectionCount: record.sections.length,
    toolCount: record.tools.length,
  });

  return record;
}

export function getDemoHomepage(userId: string): DemoHomepageRecord | null {
  const record = homepageStore.get(userId) || null;
  if (record) {
    logServiceEvent("demo-homepage", "load", {
      userId,
      sectionCount: record.sections.length,
      toolCount: record.tools.length,
    });
  } else {
    logServiceEvent("demo-homepage", "load-miss", { userId });
  }
  return record;
}
