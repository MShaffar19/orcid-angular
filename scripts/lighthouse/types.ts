export interface Audit {
  url: string
  auth?: boolean
  loggedAs?: string
}

export interface Environment {
  protocol: string
  prefix: string
  baseURL: string
  testPrefix: string
  firebaseConfig?: {
    apiKey: string
    authDomain: string
    databaseURL: string
    projectId: string
    storageBucket: string
    messagingSenderId: string
    appId: string
    measurementId: string
  }
  ORCID_URLS_TO_AUDIT?: Audit[]
  ORCID_ADMIN_USER?: string
  ORCID_ADMIN_PASSWORD?: string
}

export interface Result {
  auditDefinition: Audit
  result: string
}

export interface ResultFile {
  auditDefinition: Audit
  filePath: string
}
export interface MetadataFile {
  date: string
  environmentPrefix: string
  executedBy: string
  resultFiles: ResultFile[]
}
