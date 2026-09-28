export interface ImportantInfoItem {
  id: string;
  text: string;
  position: number;
}

export interface ImportantInfoList {
  items: readonly ImportantInfoItem[];
}
