window.MGAutomationBootstrap = (() => {
  console.log("[MG Automation] Loaded");

  const timer = setInterval(async () => {
    if (!window.QWS_Atoms || !window.MGCore || !window.MGUI) return;

    clearInterval(timer);

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