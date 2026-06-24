export interface SlideData {
  index: number;
  title: string;
  notes: string;
  texts?: string[];
}

export interface Presentation {
  id: string;
  name: string;
  source: string;
  filePath?: string;
  googleSlidesUrl?: string;
  isStarred: boolean;
  folder: string;
  totalSlides: number;
  slides: SlideData[];
  createdAt: number;
}

export interface ConnectionRequest {
  deviceName: string;
  fingerprint: string;
}

export interface SessionInfo {
  roomId: string;
  passcode: string;
  localIps: string[];
  signalingPort: number;
  presentationName: string;
}
