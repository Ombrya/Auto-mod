window.MGUtils = (() => {
  window.MG_AUTO_SOCKETS = window.MG_AUTO_SOCKETS || [];

  const NativeWebSocket = window.WebSocket;

  if (!window.__MG_WS_TRACKED__) {
    window.__MG_WS_TRACKED__ = true;

    window.WebSocket = function (...args) {
      const ws = new NativeWebSocket(...args);
      window.MG_AUTO_SOCKETS.push(ws);
      ws.addEventListener("close", () => {
        window.MG_AUTO_SOCKETS = window.MG_AUTO_SOCKETS.filter(s => s !== ws);
      });
      return ws;
    };

    window.WebSocket.prototype = NativeWebSocket.prototype;
    window.WebSocket.OPEN = NativeWebSocket.OPEN;
    window.WebSocket.CLOSED = NativeWebSocket.CLOSED;
    window.WebSocket.CLOSING = NativeWebSocket.CLOSING;
    window.WebSocket.CONNECTING = NativeWebSocket.CONNECTING;
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function getOpenWS() {
    if (window.quinoaWS?.readyState === WebSocket.OPEN) return window.quinoaWS;

    const candidates = [
      ...(window.MG_AUTO_SOCKETS ?? []),
      ...(window.sockets ?? [])
    ];

    for (const ws of candidates) {
      if (ws?.readyState === WebSocket.OPEN) {
        window.quinoaWS = ws;
        return ws;
      }
    }

    return null;
  }

  function send(payload) {
    const ws = getOpenWS();

    if (!ws) {
      console.warn("[MG Automation] No open WebSocket", payload);
      return false;
    }

    ws.send(JSON.stringify({
      scopePath: ["Room", "Quinoa"],
      ...payload
    }));

    return true;
  }

  return { sleep, getOpenWS, send };
})();