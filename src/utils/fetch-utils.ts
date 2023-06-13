import fetch, { RequestInfo, RequestInit, Response } from "node-fetch";

// fetch with exponential backoff
// https://cloud.google.com/functions/docs/bestpractices/tips#use_exponential_backoff_with_retries
export async function fetchWithRetry(url: RequestInfo, options: RequestInit, retries = 3, backoff = 1000): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (retries === 0) {
      throw err;
    }
    await new Promise(resolve => setTimeout(resolve, backoff));
    return await fetchWithRetry(url, options, retries - 1, backoff * 2);
  }
}