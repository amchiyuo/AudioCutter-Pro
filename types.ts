export interface RegionData {
  id: string;
  start: number;
  end: number;
  label?: string;
  color?: string;
}

export interface AudioFileMetadata {
  name: string;
  size: number;
  type: string;
  duration: number;
}
