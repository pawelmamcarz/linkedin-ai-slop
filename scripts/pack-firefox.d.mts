export interface FirefoxManifest {
  host_permissions: string[];
  content_scripts: { matches: string[]; [key: string]: unknown }[];
  background: { scripts: string[]; service_worker?: string };
  browser_specific_settings: {
    gecko: {
      id: string;
      strict_min_version: string;
      data_collection_permissions: { required: string[] };
    };
  };
  [key: string]: unknown;
}

export function firefoxManifest(base: Record<string, unknown>): FirefoxManifest;
