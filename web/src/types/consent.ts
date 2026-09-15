export interface ConsentRecord {
  uid: string;
  timestamp: string;
  version: string;
}

export interface ConsentStatusResponse {
  hasConsented: boolean;
  consent: ConsentRecord | null;
}
