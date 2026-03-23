import * as SecureStore from "expo-secure-store";

export async function getItem(key: string) {
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string) {
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string) {
  await SecureStore.deleteItemAsync(key);
}

export async function getJsonItem<T>(key: string): Promise<T | null> {
  const value = await getItem(key);
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    await removeItem(key);
    return null;
  }
}

export async function setJsonItem<T>(key: string, value: T) {
  await setItem(key, JSON.stringify(value));
}
