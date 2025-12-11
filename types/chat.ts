
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  images?: string[]; // Array of base64 strings (no data URI prefix)
  timestamp: number;
  isStreaming?: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
}
