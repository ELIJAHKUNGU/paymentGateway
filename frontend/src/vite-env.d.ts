/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_USE_MOCK_DATA: string
  readonly VITE_MPESA_CONSUMER_KEY: string
  readonly VITE_MPESA_BUSINESS_SHORT_CODE: string
  readonly VITE_MPESA_CALLBACK_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}