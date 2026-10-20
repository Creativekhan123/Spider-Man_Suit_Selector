from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time

options = Options()
options.add_argument("--headless=new")
options.add_argument("--use-fake-ui-for-media-stream")
options.add_argument("--use-fake-device-for-media-stream")
options.add_argument("--no-sandbox")
options.add_argument("--window-size=1920,1080")

driver = webdriver.Chrome(options=options)
try:
    driver.get("http://localhost:5173/")
    time.sleep(4)
    # Check spiderman3 bounding box & rotation
    res = driver.execute_script("""
        const slot = window.app.holoScene.suitRack.slots.find(s => s.suitConfig.id === 'spiderman3');
        if (!slot || !slot.miniModel) return { error: 'No spiderman3 slot' };
        const box = new THREE.Box3().setFromObject(slot.miniModel);
        const size = new THREE.Vector3();
        box.getSize(size);
        return {
            size: { x: size.x, y: size.y, z: size.z },
            rot: [slot.miniModel.rotation.x, slot.miniModel.rotation.y, slot.miniModel.rotation.z]
        };
    """)
    print("SPIDERMAN 3 DIMENSIONS:", res)
finally:
    driver.quit()
