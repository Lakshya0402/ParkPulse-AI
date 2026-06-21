/**
 * useMapplsLoader
 *
 * Dynamically loads the Mappls (MapmyIndia) Map SDK script into the page.
 * The SDK key is pulled from VITE_MAPPLS_MAP_SDK_KEY (set in your .env file).
 *
 * Mappls SDK reference (v3.0 - NEW AUTH):
 *   https://developer.mappls.com/documentation/sdk/Web/Web%20JS/
 *
 * Usage:
 *   const { ready, error } = useMapplsLoader()
 *   if (!ready) return <Spinner />
 *   // now window.mappls is available
 */
import { useState, useEffect } from "react";

const SCRIPT_ID = "mappls-map-sdk";

let _loaded = false;
let _callbacks = [];

function notifyAll(err) {
  _callbacks.forEach((cb) => cb(err));
  _callbacks = [];
}

function loadScript(key) {
  if (document.getElementById(SCRIPT_ID)) {
    return;
  }

  const src = `https://apis.mappls.com/advancedmaps/api/${key}/map_sdk?v=3.0&layer=vector`;

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = src;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    // Wait for window.mappls to be available
    let attempts = 0;
    const maxAttempts = 60; // 3 seconds
    const checkReady = setInterval(() => {
      attempts++;
      const mapplsExists = !!window.mappls;

      if (window.mappls && typeof window.mappls === "object") {
        clearInterval(checkReady);
        _loaded = true;
        notifyAll(null);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkReady);
        console.error("Mappls SDK failed to initialize after 3 seconds");
        notifyAll(
          new Error(
            "Mappls SDK failed to load. Verify your API key and try again.",
          ),
        );
      }
    }, 50);
  };
  script.onerror = () => {
    console.error("Failed to load Mappls script:", src);
    notifyAll(
      new Error(
        "Failed to load Mappls SDK script. Check your API key or network connection.",
      ),
    );
  };
  document.head.appendChild(script);
}

export function useMapplsLoader() {
  const [ready, setReady] = useState(_loaded);
  const [error, setError] = useState(null);

  useEffect(() => {
    const key = import.meta.env.VITE_MAPPLS_MAP_SDK_KEY;
    if (!key || key === "your_mappls_map_sdk_key_here") {
      setError(
        "VITE_MAPPLS_MAP_SDK_KEY not set. Add it to your frontend .env file.",
      );
      return;
    }
    if (_loaded) {
      setReady(true);
      return;
    }
    _callbacks.push((err) => {
      if (err) setError(err.message);
      else setReady(true);
    });
    loadScript(key);
  }, []);

  return { ready, error };
}
