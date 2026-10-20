from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time
import json

options = Options()
options.add_argument("--headless=new")
options.add_argument("--use-fake-ui-for-media-stream")
options.add_argument("--use-fake-device-for-media-stream")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--window-size=1920,1080")

driver = webdriver.Chrome(options=options)
try:
    driver.get("http://localhost:5173/")
    time.sleep(5)
    
    # Check what materials and maps exist on loaded suits
    res = driver.execute_script("""
        const app = window.app;
        if (!app || !app.holoScene) return { error: 'No holoScene' };
        const results = [];
        const suits = window.app.holoScene.modelLoader.cache;
        for (let [id, obj] of suits.entries()) {
            let meshCount = 0;
            let withMap = 0;
            let origMaterials = [];
            obj.traverse(c => {
                if (c.isMesh) {
                    meshCount++;
                    const orig = c.userData.originalMaterial;
                    if (orig) {
                        const mats = Array.isArray(orig) ? orig : [orig];
                        mats.forEach(m => {
                            if (m.map) withMap++;
                            origMaterials.push({
                                type: m.type,
                                hasMap: !!m.map,
                                mapUrl: m.map && m.map.image ? m.map.image.src : null,
                                color: m.color ? m.color.getHexString() : null
                            });
                        });
                    }
                }
            });
            results.push({ id, meshCount, withMap, origMaterials: origMaterials.slice(0, 3) });
        }
        return results;
    """)
    print("LOADED SUITS DIAGNOSTICS:")
    print(json.dumps(res, indent=2))
finally:
    driver.quit()
