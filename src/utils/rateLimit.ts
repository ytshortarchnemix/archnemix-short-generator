const LIMIT = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const KEY = "archnemix_rate_limit";

type RateData = {
  count: number;
  resetAt: number;
};

export function checkRateLimit(): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const raw = localStorage.getItem(KEY);

  let data: RateData;

  if (!raw) {
    data = {
      count: 0,
      resetAt: now + WINDOW_MS
    };
  } else {
    data = JSON.parse(raw);

    if (now > data.resetAt) {
      data = {
        count: 0,
        resetAt: now + WINDOW_MS
      };
    }
  }

  if (data.count >= LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: data.resetAt
    };
  }

  data.count += 1;
  localStorage.setItem(KEY, JSON.stringify(data));

  return {
    allowed: true,
    remaining: LIMIT - data.count,
    resetAt: data.resetAt
  };
}
