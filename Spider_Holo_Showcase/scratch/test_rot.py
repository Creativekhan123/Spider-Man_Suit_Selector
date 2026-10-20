from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time

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
        const slot = window.app.holoScene.suitRack.slots.find(s => s.suitConfig.id === 'spiderman3');
        if (!slot || !slot.miniModel) return { error: 'No spiderman3 slot' };
        
        // Test rotations: [-Math.PI/2, 0, 0] vs [Math.PI/2, 0, 0]
        const m = slot.miniModel;
        m.children[0].rotation.set(-Math.PI / 2, 0, 0);
        m.children[0].updateMatrixWorld(true);
        const box1 = new THREE.Box3().setFromObject(m);
        const size1 = new THREE.Vector3();
        box1.getSize(size1);

        m.children[0].rotation.set(Math.PI / 2, 0, 0);
        m.children[0].updateMatrixWorld(true);
        const box2 = new THREE.Box3().setFromObject(m);
        const size2 = new THREE.Vector3();
        box2.getSize(size2);

        return {
            rot_minus_90: { x: size1.x, y: size1.y, z: size1.z },
            rot_plus_90: { x: size2.x, y: size2.y, z: size2.z }
        };
    """)
    print("ROTATION TEST:", res)
finally:
    driver.quit()
