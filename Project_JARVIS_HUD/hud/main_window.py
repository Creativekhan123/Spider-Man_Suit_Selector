"""Main Application Window & Orchestrator
Coordinates camera capture thread, gesture routing, 60 FPS animation timer,
and user interaction events.
"""
import time
from typing import Optional, List
from app.qt_compat import (
    QMainWindow, QWidget, QTimer, QPainter, QImage,
    Qt, Signal, Slot, QPointF
)
from app.configuration import HUDConfiguration, ConfigurationManager
from app.state import (
    CameraState, HandTrackingData, GestureType,
    HUDMode, SystemTelemetry, VirtualCursorState
)
from camera.frame_processor import CameraWorkerThread
from vision.gesture_recognizer import GestureRecognizer
from interaction.cursor_controller import CursorController
from interaction.gesture_router import GestureRouter
from hud.panel_manager import PanelManager
from hud.hud_renderer import HUDRenderer
from services.sound_service import SoundService
from services.command_service import CommandService


class HUDMainWindow(QMainWindow):
    """Top-level PySide6/PyQt6 holographic desktop window."""

    def __init__(self, config_manager: Optional[ConfigurationManager] = None):
        super().__init__()
        self.config_mgr = config_manager or ConfigurationManager()
        self.config = self.config_mgr.get()

        self.setWindowTitle("Project JARVIS HUD // Tactical Holographic Interface")
        self.resize(1280, 720)
        self.setMinimumSize(960, 540)

        # Services & State
        self.sound_service = SoundService(enabled=self.config.audio_enabled)
        self.command_service = CommandService()
        self.gesture_recognizer = GestureRecognizer(self.config)
        self.cursor_controller = CursorController(self.config)
        self.gesture_router = GestureRouter(self.config)
        self.panel_mgr = PanelManager(self.config)
        self.renderer = HUDRenderer(self.config)

        # Wire up gesture router callbacks
        self.gesture_router.on_mode_changed = self._on_mode_changed
        self.gesture_router.on_sound_requested = self.sound_service.play

        # Wire up panel manager callbacks
        self.panel_mgr.on_mode_click = self.gesture_router.set_mode
        self.panel_mgr.on_exit_click = self.close
        self.panel_mgr.on_reset_object = self.gesture_router.reset_virtual_object
        self.panel_mgr.on_scale_object = self._on_scale_object
        self.panel_mgr.on_switch_cam = self._on_switch_cam
        self.panel_mgr.on_config_changed = lambda: self.config_mgr.save()

        # Register allowlisted commands
        self._register_commands()

        # Frame & Telemetry buffers
        self.latest_frame: Optional[QImage] = None
        self.latest_hands: List[HandTrackingData] = []
        self.camera_status: str = CameraState.CAMERA_CONNECTING.value
        self.telemetry = SystemTelemetry()

        # Camera Switcher & Toast Notification State
        self.toast_message: Optional[str] = None
        self.toast_expiry: float = 0.0
        self.available_camera_ids: List[int] = [0, 1, 2]

        # Render FPS Tracking
        self._render_frame_times: List[float] = []

        # Mouse fallback support
        self._use_mouse_fallback: bool = False
        self.setMouseTracking(True)

        # Initialize Background Camera Worker Thread
        self.worker = CameraWorkerThread(self.config, parent=self)
        self.worker.frame_ready.connect(self._on_frame_ready)
        self.worker.camera_status_changed.connect(self._on_camera_status_changed)
        self.worker.camera_error.connect(self._on_camera_error)
        self.worker.start()

        # 60 FPS Render Timer
        self.render_timer = QTimer(self)
        self.render_timer.timeout.connect(self._render_tick)
        self.render_timer.start(16)  # ~60 FPS

        # Initial layout build
        self.panel_mgr.build_layout(self.width(), self.height(), self.gesture_router.current_mode)

        # Play startup cue
        self.sound_service.play("spawn")

    def _register_commands(self):
        """Registers allowlisted commands in CommandService."""
        self.command_service.register("open_panel", lambda panel: self.gesture_router.set_mode(HUDMode(panel)))
        self.command_service.register("set_fullscreen", lambda enabled: self.showFullScreen() if enabled else self.showNormal())
        self.command_service.register("set_preview_visible", lambda visible: setattr(self.config, "show_camera_feed", visible))
        self.command_service.register("reset_virtual_object", self.gesture_router.reset_virtual_object)
        self.command_service.register("set_hud_mode", lambda mode: self.gesture_router.set_mode(HUDMode(mode)))
        self.command_service.register("switch_camera", lambda id: self.switch_camera(int(id)))
        self.command_service.register("cycle_camera", lambda: self.cycle_camera(1))

    def show_toast(self, message: str, duration: float = 2.5):
        """Displays a temporary sci-fi notification banner."""
        self.toast_message = message
        self.toast_expiry = time.perf_counter() + duration

    def switch_camera(self, cam_id: int):
        """Switches to the specified camera index with audio & visual feedback."""
        self.config.camera_id = cam_id
        self.worker.switch_camera(cam_id)
        self.config_mgr.save()
        self.sound_service.play("assemble")
        self.show_toast(f"CAMERA INPUT // DEVICE #{cam_id}")

    def cycle_camera(self, delta: int = 1):
        """Cycles to the next or previous camera index."""
        if not self.available_camera_ids:
            return
        try:
            curr_idx = self.available_camera_ids.index(self.config.camera_id)
        except ValueError:
            curr_idx = 0
        next_idx = (curr_idx + delta) % len(self.available_camera_ids)
        self.switch_camera(self.available_camera_ids[next_idx])

    def _on_mode_changed(self, new_mode: HUDMode):
        self.panel_mgr.build_layout(self.width(), self.height(), new_mode)

    def _on_scale_object(self, delta: float):
        obj = self.gesture_router.virtual_object
        obj.scale = max(0.4, min(3.0, obj.scale + delta))

    def _on_switch_cam(self, cam_id: int):
        self.switch_camera(cam_id)

    @Slot(object, list, object)
    def _on_frame_ready(self, qimage: QImage, hands: List[HandTrackingData], telemetry: SystemTelemetry):
        """Dispatched from worker thread when a new frame is processed."""
        self.latest_frame = qimage
        self.latest_hands = hands

        # Update telemetry
        self.telemetry.camera_fps = telemetry.camera_fps
        self.telemetry.inference_time_ms = telemetry.inference_time_ms
        self.telemetry.total_frame_latency_ms = telemetry.total_frame_latency_ms
        self.telemetry.cpu_percent = telemetry.cpu_percent
        self.telemetry.ram_percent = telemetry.ram_percent
        self.telemetry.active_camera_name = telemetry.active_camera_name
        self.telemetry.frame_width = telemetry.frame_width
        self.telemetry.frame_height = telemetry.frame_height
        self.telemetry.hands_detected = len(hands)

        # Recognize Gesture
        active_gesture = self.gesture_recognizer.recognize(hands)
        primary_hand = hands[0] if len(hands) > 0 else None
        if primary_hand:
            primary_hand.gesture = active_gesture

        # Update Holographic Cursor
        cursor = self.cursor_controller.update(
            primary_hand=primary_hand,
            viewport_width=self.width(),
            viewport_height=self.height(),
            is_pinching=self.gesture_recognizer.is_pinching,
            pinch_just_engaged=self.gesture_recognizer.pinch_just_engaged,
            pinch_just_released=self.gesture_recognizer.pinch_just_released
        )

        # Update Button Hover & Clicks
        if cursor.is_active:
            self.panel_mgr.update_hover(cursor.screen_x, cursor.screen_y)

            # Check discrete click event
            if cursor.click_just_pressed:
                clicked_btn = self.panel_mgr.trigger_click_at(cursor.screen_x, cursor.screen_y)
                if clicked_btn:
                    self.sound_service.play("lock")

        # Process Gesture Router (object manipulation, mode swipe)
        self.gesture_router.process(
            gesture=active_gesture,
            cursor=cursor,
            hands=hands,
            viewport_w=self.width(),
            viewport_h=self.height()
        )

    @Slot(str)
    def _on_camera_status_changed(self, status: str):
        self.camera_status = status

    @Slot(str)
    def _on_camera_error(self, err_msg: str):
        print(f"[HUD Error] Camera error: {err_msg}")
        self.camera_status = CameraState.CAMERA_OFFLINE.value

    def _render_tick(self):
        """Calculates render FPS and invalidates canvas for repaint."""
        now = time.perf_counter()
        self._render_frame_times.append(now)
        if len(self._render_frame_times) > 30:
            self._render_frame_times.pop(0)

        if len(self._render_frame_times) > 1:
            dur = self._render_frame_times[-1] - self._render_frame_times[0]
            if dur > 0:
                self.telemetry.render_fps = (len(self._render_frame_times) - 1) / dur

        # Auto-expire toast notification banner
        if self.toast_message and now > self.toast_expiry:
            self.toast_message = None

        self.renderer.update_animations()
        self.update()  # Triggers paintEvent

    def paintEvent(self, event):
        """Paints the composited holographic HUD scene."""
        painter = QPainter(self)
        self.renderer.render(
            painter=painter,
            width=self.width(),
            height=self.height(),
            camera_frame=self.latest_frame,
            hands=self.latest_hands,
            cursor=self.cursor_controller.cursor_state,
            camera_status=self.camera_status,
            current_mode=self.gesture_router.current_mode,
            virtual_object=self.gesture_router.virtual_object,
            telemetry=self.telemetry,
            panel_mgr=self.panel_mgr,
            toast_message=self.toast_message
        )
        painter.end()

    def resizeEvent(self, event):
        """Handles window resize dynamically."""
        super().resizeEvent(event)
        self.panel_mgr.build_layout(self.width(), self.height(), self.gesture_router.current_mode)
        self.renderer.particles.resize(self.width(), self.height())

    def keyPressEvent(self, event):
        """Keyboard fallback shortcuts."""
        key = event.key()
        if key in (Qt.Key.Key_Escape, Qt.Key.Key_Q):
            self.close()
        elif key == Qt.Key.Key_Space:
            self.gesture_router.cycle_mode(direction=1)
        elif key in (Qt.Key.Key_C, Qt.Key.Key_BracketRight):
            self.cycle_camera(1)
        elif key == Qt.Key.Key_BracketLeft:
            self.cycle_camera(-1)
        elif key == Qt.Key.Key_0:
            self.switch_camera(0)
        elif key == Qt.Key.Key_1:
            self.switch_camera(1)
        elif key == Qt.Key.Key_2:
            self.switch_camera(2)
        elif key == Qt.Key.Key_3:
            self.switch_camera(3)
        elif key == Qt.Key.Key_4:
            self.switch_camera(4)
        elif key == Qt.Key.Key_M:
            self.config.mirror_camera = not self.config.mirror_camera
            self.config_mgr.save()
            self.show_toast("CAMERA MIRROR " + ("ENABLED" if self.config.mirror_camera else "DISABLED"))
        elif key == Qt.Key.Key_H:
            self.config.show_camera_feed = not self.config.show_camera_feed
            self.config_mgr.save()
            self.show_toast("CAMERA FEED " + ("VISIBLE" if self.config.show_camera_feed else "HIDDEN"))
        elif key == Qt.Key.Key_F11:
            if self.isFullScreen():
                self.showNormal()
            else:
                self.showFullScreen()
        else:
            super().keyPressEvent(event)

    def mouseMoveEvent(self, event):
        """Mouse fallback navigation when testing without webcam hand pose."""
        if not self.cursor_controller.cursor_state.is_active:
            x = event.position().x()
            y = event.position().y()
            self.panel_mgr.update_hover(x, y)

    def mousePressEvent(self, event):
        """Mouse fallback click trigger."""
        if not self.cursor_controller.cursor_state.is_active:
            x = event.position().x()
            y = event.position().y()
            btn = self.panel_mgr.trigger_click_at(x, y)
            if btn:
                self.sound_service.play("lock")

    def closeEvent(self, event):
        """Performs clean camera and thread shutdown."""
        self.render_timer.stop()
        if hasattr(self, "worker") and self.worker.isRunning():
            self.worker.stop()
        self.config_mgr.save()
        super().closeEvent(event)
