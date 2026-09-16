export interface KnowledgeFile {
  id: string;
  itemId: string;
  kind: 'attachment' | 'personPhoto';
  processing: 'raw' | 'normalizedRasterImage';
  mimeType: string;
  sizeBytes: number;
  name: string;
  originalName: string;
  contentPath: string;
  createdAt: string;
  updatedAt: string;
}
