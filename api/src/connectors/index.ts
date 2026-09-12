import { nasaConnector } from "./nasa";
import type { Connector, SourceSystemId } from "./types";
import { wikimediaConnector } from "./wikimedia";
import { youtubeConnector } from "./youtube";

const connectors: Record<SourceSystemId, Connector> = {
  youtube: youtubeConnector,
  nasa_images: nasaConnector,
  wikimedia_commons: wikimediaConnector,
};

export const SOURCE_SYSTEM_IDS = Object.keys(connectors) as SourceSystemId[];

export function getConnector(id: SourceSystemId): Connector {
  return connectors[id];
}
