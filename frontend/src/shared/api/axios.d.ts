import "axios";

declare module "axios" {
  interface RequestMetadata {
    requestId?: string;
    cachePolicy?: "default" | "bypass";
  }

  interface AxiosRequestConfig {
    _retry?: boolean;
    metadata?: RequestMetadata;
  }

  interface InternalAxiosRequestConfig {
    _retry?: boolean;
    metadata?: RequestMetadata;
  }

  interface AxiosError {
    requestId?: string;
  }
}
