// src/backend/lib/config.ts
const CONFIG = {
  MODEL: "nvidia/nemotron-3-ultra-550b-a55b",
  TIMEOUT_MS: 60000,
  MAX_SOURCE_LENGTH: 20000,
  MAX_REQUEST_BYTES: 100000,
  MIN_INTERVAL_MS: 4800,
  CACHE_TTL_MS: 5 * 60 * 1000,
  CACHE_MAX: 200,
  CACHE_MAX_TEXT_LENGTH: 4000,
  RATE_LIMIT_WINDOW_MS: 60000,
  RATE_LIMIT_MAX_REQUESTS: 15,
  UPSTREAM: {
    temperature: 0.2,
    top_p: 0.95,
    max_tokens: 16384,
  },
};

function getKey(env) {
  const key = (env.NVIDIA_API_KEY ?? "").trim();
  if (!key) throw Object.assign(new Error("NO_KEY"), { code: "NO_KEY" });
  return key;
}

// src/backend/lib/circuit-breaker.ts
const CircuitState = { CLOSED: "closed", OPEN: "open", HALF_OPEN: "half_open" };

class CircuitBreaker {
  constructor(config) {
    this.config = config;
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.nextAttempt = 0;
  }

  async execute(operation, countFailure = () => true) {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) throw new Error("CIRCUIT_OPEN");
      this.state = CircuitState.HALF_OPEN;
    }
    try {
      const result = await operation();
      this.failures = 0;
      this.state = CircuitState.CLOSED;
      return result;
    } catch (error) {
      if (countFailure(error)) {
        this.failures++;
        if (this.failures >= this.config.failureThreshold) {
          this.state = CircuitState.OPEN;
          this.nextAttempt = Date.now() + this.config.resetTimeoutMs;
        }
      }
      throw error;
    }
  }

  getState() {
    return this.state;
  }

  reset() {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.nextAttempt = 0;
  }
}

let circuitBreakerInstance = null;
function getCircuitBreaker() {
  circuitBreakerInstance ??= new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30000 });
  return circuitBreakerInstance;
}

// src/backend/lib/errors.ts
function log(level, event, fields = {}) {
  console[level](JSON.stringify({ service: "sanyu-fanyi-lite", event, ...fields, ts: new Date().toISOString() }));
}

function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-translator-proxy", "1");
  return Response.json(data, { ...init, headers });
}

// src/backend/api/health.ts
async function onRequest({ request, env }) {
  const started = Date.now();
  const requestId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  try {
    getKey(env);
    log("info", "health_check", { requestId, durationMs: Date.now() - started });
    return json({
      ok: true,
      provider: "nvidia",
      model: CONFIG.MODEL,
      configured: true,
      circuitBreaker: getCircuitBreaker().getState(),
      minIntervalMs: CONFIG.MIN_INTERVAL_MS,
      rateLimitBackend: env.RATE_LIMIT_KV ? "kv" : "memory",
      distributed: Boolean(env.RATE_LIMIT_KV),
      ts: Date.now()
    });
  } catch (e) {
    const error = e;
    log("error", "health_check_failed", {
      requestId,
      code: error.code ?? "HEALTH_ERROR",
      message: error.message,
      durationMs: Date.now() - started
    });
    return json({
      ok: false,
      error: { message: error.message, code: error.code ?? "HEALTH_ERROR" }
    }, { status: 503 });
  }
}

export { onRequest };