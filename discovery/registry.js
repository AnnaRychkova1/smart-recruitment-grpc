const registry = {};

export function register(serviceName, host, port) {
  registry[serviceName] = { host, port };
  console.log(`✅ Registered: ${serviceName} at ${host}:${port}`);
}

export function getService(serviceName) {
  return registry[serviceName];
}
