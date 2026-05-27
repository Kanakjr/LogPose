// Legacy export retained for type compatibility. The original CrewPortrait
// component has been replaced by PixelPortrait + CrewDock; this file now only
// re-exports the CrewmateMeta shape used by the /crew page and CrewDock.

export type CrewmateMeta = {
  key: string;
  name: string;
  role: string;
  voice?: string;
  online?: boolean;
};
