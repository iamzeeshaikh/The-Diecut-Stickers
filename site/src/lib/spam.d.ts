export function spamReasons(input: {
  names?: string[];
  email?: string;
  phone?: string;
  message?: string;
  fields?: Record<string, string>;
  sentAt?: string | number;
  timing?: boolean;
  now?: number;
}): string[];
