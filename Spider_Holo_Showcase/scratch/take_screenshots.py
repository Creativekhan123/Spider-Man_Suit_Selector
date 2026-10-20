from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time

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
    driver.save_screenshot("scratch/screenshot_main.png")
    print("Main screenshot saved.")

    # Switch to Iron Spider
    driver.execute_script("""
        const s = window.app.holoScene.modelLoader.cache.get('spiderman6');
        window.app.selectSuit(window.SUITS_DATABASE ? window.SUITS_DATABASE[4] : { id: 'spiderman6', name: 'IRON SPIDER (MK-I)', designation: 'EARTH-199999' });
    """)
    time.sleep(2)
    driver.save_screenshot("scratch/screenshot_iron_spider.png")
    print("Iron spider screenshot saved.")

    # Switch to Advanced Suit 2.0
    driver.execute_script("""
        const suits = [
            { id: 'spiderman2', name: 'ADVANCED SUIT 2.0', designation: 'EARTH-1048' },
            { id: 'spiderman3', name: 'WEBBED RAIMI SUIT', designation: 'EARTH-96283' }
        ];
        window.app.selectSuit(suits[0]);
    """)
    time.sleep(2)
    driver.save_screenshot("scratch/screenshot_spiderman2.png")
    print("Spiderman 2 screenshot saved.")

    # Switch to Raimi Suit
    driver.execute_script("""
        window.app.selectSuit({ id: 'spiderman3', name: 'WEBBED RAIMI SUIT', designation: 'EARTH-96283' });
    """)
    time.sleep(2)
    driver.save_screenshot("scratch/screenshot_raimi.png")
    print("Raimi screenshot saved.")

finally:
    driver.quit()
