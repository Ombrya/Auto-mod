window.MGAutomationBootstrap = (() => {
  console.log("[MG Automation] Loaded");

  const timer = setInterval(async () => {
    if (
      !window.QWS_Atoms ||
      !window.MGUtils ||
      !window.MGCatalog ||
      !window.MGCore ||
      !window.MGUI
    ) {
      return;
    }

    clearInterval(timer);

    try {
      await window.MGCatalog.load();

      // Non bloquant : les sprites se chargent tranquillement en arrière-plan.
      window.MGCatalog.warmSpritesInBackground?.();
    } catch (err) {
      console.warn("[MG Automation] Catalog load failed", err);
    }

    window.MGUI.createPanel();

    if (window.MGCore.enabled) {
      await window.MGCore.start();
    } else {
      window.MGCore.setStatus("OFF");
      window.MGUI.updatePanel();
    }

    console.log("[MG Automation] Ready");
  }, 1000);
})();