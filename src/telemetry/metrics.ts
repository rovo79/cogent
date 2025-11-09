const metrics: Record<string, number[]> = {};

export function recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const key = tags ? `${name}:${Object.entries(tags).sort().map(([k, v]) => `${k}=${v}`).join(',')}` : name;
    const bucket = metrics[key] ?? [];
    bucket.push(value);
    metrics[key] = bucket;
}

export function getMetrics(): Record<string, number[]> {
    return { ...metrics };
}
