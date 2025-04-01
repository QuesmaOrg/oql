import pluginJson from './plugin.json';

export const PLUGIN_BASE_URL = `/a/${pluginJson.id}`;

export enum ROUTES {
  One = 'one',

}

export function getBackendUrl(endpoint: string) {
  return `/api/plugins/${pluginJson.id}/resources/${endpoint}`;
}
