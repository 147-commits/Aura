/**
 * Deploy Engine — one-click deployment to Vercel.
 *
 * Uses Vercel API v13/deployments to deploy static files.
 * User provides their own Vercel token (stored client-side).
 */

import { query } from "./db";

export interface DeployResult {
  url: string;
  deploymentId: string;
}

/**
 * Deploy files to Vercel.
 * Returns the live URL once deployment is ready.
 */
export async function deployToVercel(
  projectName: string,
  files: Record<string, string>,
  vercelToken: string
): Promise<DeployResult> {
  const cleanName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);

  const response = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: cleanName,
      files: Object.entries(files).map(([file, content]) => ({
        file,
        data: content,
        encoding: "utf-8",
      })),
      projectSettings: {
        framework: null,
        buildCommand: "",
        outputDirectory: ".",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vercel deployment failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  const deploymentId = data.id || "";
  const url = data.url ? `https://${data.url}` : "";

  return { url, deploymentId };
}

/**
 * Save deploy URL to the builder project record.
 */
export async function saveDeployUrl(
  projectId: string,
  deployUrl: string
): Promise<void> {
  await query(
    "UPDATE builder_projects SET deploy_url = $1, updated_at = NOW() WHERE id = $2",
    [deployUrl, projectId]
  );
}

/**
 * Check deployment status on Vercel.
 */
export async function checkDeployStatus(
  deploymentId: string,
  vercelToken: string
): Promise<{ state: string; url: string }> {
  const response = await fetch(
    `https://api.vercel.com/v13/deployments/${deploymentId}`,
    { headers: { Authorization: `Bearer ${vercelToken}` } }
  );

  if (!response.ok) throw new Error("Failed to check deployment status");

  const data = await response.json();
  return {
    state: data.readyState || data.state || "UNKNOWN",
    url: data.url ? `https://${data.url}` : "",
  };
}
