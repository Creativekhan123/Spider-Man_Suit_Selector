from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time
import json

options = Options()
options.add_argument("--headless=new")
options.add_argument("--use-fake-ui-for-media-stream")
options.add_argument("--use-fake-device-for-media-stream")
options.add_argument("--no-sandbox")

driver = webdriver.Chrome(options=options)
try:
    driver.get("http://localhost:5173/")
    time.sleep(3)
    
    res = driver.execute_script("""
        const app = window.app;
        const out = {};
        ['spiderman6', 'spiderman8'].forEach(id => {
            const obj = app.holoScene.modelLoader.cache.get(id);
            if (!obj) return;
            out[id] = [];
            obj.traverse(c => {
                if (c.isMesh) {
                    const mats = Array.isArray(c.material) ? c.material : [c.material];
                    const orig = c.userData.originalMaterial;
                    const origMats = Array.isArray(orig) ? orig : [orig];
                    out[id].push({
                        meshName: c.name,
                        origMatNames: origMats.map(m => m ? m.name : 'none')
                    });
                }
            });
        });
        return out;
    """)
    print("MATERIAL NAMES:")
    print(json.dumps(res, indent=2))
finally:
    driver.quit()
