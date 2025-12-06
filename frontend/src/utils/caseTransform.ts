/**
 * Utility functions to transform object keys between snake_case and camelCase.
 * Used for API communication where backend uses snake_case and frontend uses camelCase.
 */

/**
 * Convert a snake_case string to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert a camelCase string to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Transform all keys in an object from snake_case to camelCase
 */
export function keysToCamel<T = any>(obj: any, depth: number = 0): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => keysToCamel(item, depth + 1)) as any;
  }

  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = snakeToCamel(key);
      result[camelKey] = keysToCamel(obj[key], depth + 1);
    }
  }
  return result;
}

/**
 * Transform all keys in an object from camelCase to snake_case
 * @param skipKeys - Array of keys to skip transformation (keeps original structure)
 */
export function keysToSnake<T = any>(obj: any, skipKeys: string[] = []): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => keysToSnake(item, skipKeys)) as any;
  }

  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const snakeKey = camelToSnake(key);
      // Skip transformation for specified keys - preserve original structure
      if (skipKeys.includes(key)) {
        result[snakeKey] = obj[key];
      } else {
        result[snakeKey] = keysToSnake(obj[key], skipKeys);
      }
    }
  }
  return result;
}
