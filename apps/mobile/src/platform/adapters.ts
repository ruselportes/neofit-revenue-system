import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import type { HttpResponse, IConnectivity, IHttpClient, IKeyValueStore, ITextRecognizer, OcrImage } from '@neofit/core';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { recognizeText } from 'expo-mlkit-ocr';

/** The phone's AsyncStorage as the core's key-value store (offline queue, scan counter). */
export class AsyncStorageStore implements IKeyValueStore {
  getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  }
  setItem(key: string, value: string): Promise<void> {
    return AsyncStorage.setItem(key, value);
  }
}

/** HTTP with a time limit, so a bad connection falls back to offline reading instead of hanging. */
export class FetchHttpClient implements IHttpClient {
  constructor(private readonly timeoutMs = 30_000) {}

  async postJson(url: string, body: unknown): Promise<HttpResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      return { ok: res.ok, status: res.status, json: () => res.json(), text: () => res.text() };
    } catch (err) {
      throw controller.signal.aborted ? new Error('The request timed out.') : err;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class NetInfoConnectivity implements IConnectivity {
  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable !== false;
  }
}

export class MlKitRecognizer implements ITextRecognizer {
  async recognize(imageUri: string): Promise<string> {
    const result = await recognizeText(imageUri);
    return result.text;
  }
}

/** A captured page, resized to 1,600 pixels wide and compressed (SDD Section 4.2). */
export async function prepareImage(uri: string): Promise<OcrImage> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 1600 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
  return {
    uri: saved.uri,
    mimeType: 'image/jpeg',
    loadBase64: async () => saved.base64 ?? '',
  };
}
