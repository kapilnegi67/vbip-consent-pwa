export interface Tenant {
  id: string;
  name: string;
  branding: Record<string, any>;
  config_json: Record<string, any>;
}

export interface User {
  id: string;
  tenant_id: string;
  role: 'agent' | 'admin' | 'compliance_officer';
  auth_provider: string;
  attrs: Record<string, any>;
}

export interface Customer {
  id: string;
  tenant_id: string;
  pii_masked: Record<string, any>;
  contact: string;
  locale: string;
}

export interface VBIPSession {
  id: string;
  tenant_id: string;
  customer_id: string;
  state: 'started' | 'liveness_pending' | 'consent_pending' | 'verification_pending' | 'completed' | 'failed';
  started_at: string;
  ended_at?: string;
  agent_id: string;
}

export interface MediaAsset {
  id: string;
  session_id: string;
  type: 'video' | 'audio' | 'image';
  url?: string;
  checksum: string;
  kms_key_id?: string;
  encryption_meta?: Record<string, any>;
  size_bytes: number;
  chunks_uploaded: number;
}

export interface Verification {
  id: string;
  session_id: string;
  kind: 'liveness' | 'face' | 'voice' | 'aadhaar' | 'cersai';
  status: 'pending' | 'completed' | 'failed';
  score: number;
  raw_ref?: string;
}

export interface Consent {
  id: string;
  session_id: string;
  script_version: string;
  terms_hash: string;
  accepted_at: string;
  acceptance_audio_ref?: string;
  acceptance_video_ref?: string;
}

export interface Geotag {
  id: string;
  session_id: string;
  lat: number;
  lon: number;
  source: string;
  india_validated: boolean;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  actor: string;
  action: string;
  target: string;
  ts: string;
  immutable_seq: number;
}

export interface MediaChunk {
  id: string;
  session_id: string;
  media_id: string;
  index: number;
  blob: Blob;
  checksum: string;
  uploaded: boolean;
  server_ack?: {
    etag: string;
    confirmation: string;
  };
}

export interface UploadQueueItem {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body_ref?: string;
  checksum?: string;
  retry_count: number;
  created_at: string;
  idempotency_key: string;
}

export interface CaptureConfig {
  chunkMs: number;
  lowBandwidth: boolean;
  video: boolean;
  audio: boolean;
  maxDuration?: number;
  videoConstraints?: MediaTrackConstraints;
  audioConstraints?: MediaTrackConstraints;
}

export interface PWAConfig {
  features: {
    offlineMode: boolean;
    backgroundSync: boolean;
    pushNotifications: boolean;
    biometricCapture: boolean;
  };
  capture: {
    defaultChunkMs: number;
    maxFileSize: number;
    supportedFormats: string[];
  };
  upload: {
    maxRetries: number;
    retryDelayMs: number;
    chunkSize: number;
  };
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SessionCreateRequest {
  tenant_id: string;
  customer_id: string;
  agent_id: string;
}

export interface LivenessRequest {
  session_id: string;
  challenge_type: 'blink' | 'smile' | 'turn_head';
  response_data: any;
}

export interface MediaUploadRequest {
  session_id: string;
  media_id: string;
  chunk_index: number;
  total_chunks: number;
  checksum: string;
}

export interface VerificationRequest {
  session_id: string;
  kind: 'liveness' | 'face' | 'voice' | 'aadhaar' | 'cersai';
  data: any;
}

export interface ConsentRequest {
  session_id: string;
  script_version: string;
  terms_hash: string;
  acceptance_audio_ref?: string;
  acceptance_video_ref?: string;
}
