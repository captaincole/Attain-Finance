/**
 * Opinion Storage Module
 *
 * Manages expert analysis opinions that layer on top of tool outputs.
 * Opinions are text prompts that guide AI analysis using specific methodologies.
 */

import { getSupabaseServiceRole } from "../supabase.js";

export interface Opinion {
  id: string;
  name: string;
  author: string;
  author_url?: string | null;
  tool_name: string;
  description?: string | null;
  prompt: string;
  created_at: string;
}

/**
 * Get a specific opinion by ID
 */
export async function getOpinionById(opinionId: string): Promise<Opinion | null> {
  const { data, error } = await getSupabaseServiceRole()
    .from("opinions" as any)
    .select("*")
    .eq("id", opinionId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching opinion:", error);
    throw new Error(`Failed to fetch opinion: ${error.message}`);
  }

  return data as unknown as Opinion;
}

/**
 * Get all opinions for a specific tool
 */
export async function getOpinionsByTool(toolName: string): Promise<Opinion[]> {
  const { data, error } = await getSupabaseServiceRole()
    .from("opinions" as any)
    .select("*")
    .eq("tool_name", toolName)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching opinions by tool:", error);
    throw new Error(`Failed to fetch opinions: ${error.message}`);
  }

  return (data || []) as unknown as Opinion[];
}

/**
 * Get all available opinions (for browsing)
 */
export async function getAllOpinions(): Promise<Opinion[]> {
  const { data, error } = await getSupabaseServiceRole()
    .from("opinions" as any)
    .select("*")
    .order("tool_name", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching all opinions:", error);
    throw new Error(`Failed to fetch opinions: ${error.message}`);
  }

  return (data || []) as unknown as Opinion[];
}

/**
 * Format opinion list for display
 */
export function formatOpinionList(opinions: Opinion[]): string {
  if (opinions.length === 0) {
    return "No opinions available for this tool.";
  }

  let output = "## Available Expert Opinions\n\n";

  opinions.forEach((opinion, index) => {
    output += `${index + 1}. **${opinion.name}** by ${opinion.author}\n`;
    if (opinion.description) {
      output += `   ${opinion.description}\n`;
    }
    output += `   ID: \`${opinion.id}\`\n\n`;
  });

  output += `\nTo apply an opinion, call: \`get-opinion\` with the opinion ID`;

  return output;
}
