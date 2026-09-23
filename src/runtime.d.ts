declare module '@libs/fetch' {
  export function fetchApi(url: string, init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<{
    ok: boolean;
    status: number;
    url?: string;
    headers: { get(name: string): string | null };
    text(): Promise<string>;
  }>;
}
declare module '@libs/storage' {
  export const localStorage: { get(): Record<string, string> | undefined };
}
