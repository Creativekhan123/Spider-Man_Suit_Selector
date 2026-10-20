"""Interactive Holographic Panels & HUD Widget Manager
Defines interactive sci-fi buttons, layout geometry, hit-testing, and panel rendering.
"""
from typing import List, Callable, Optional, Dict, Any
from app.qt_compat import QRectF, QPointF, QPainter, QColor, QPen, QBrush, QFont
from app.state import HUDMode, CameraState, HandTrackingData, GestureType, SystemTelemetry, VirtualObjectState
from app.configuration import HUDConfiguration


class HUDButton:
    """An interactive sci-fi holographic button."""

    def __init__(self, btn_id: str, label: str, rect: QRectF, on_click: Callable[[], Any]):
        self.btn_id = btn_id
        self.label = label
        self.rect = rect
        self.on_click = on_click
        self.is_hovered = False
        self.is_pressed = False
        self.is_active = False  # e.g., for selected mode tab

    def hit_test(self, x: float, y: float) -> bool:
        return self.rect.contains(x, y)


class PanelManager:
    """Coordinates HUD panels, button layout, and click dispatch."""

    def __init__(self, config: HUDConfiguration):
        self.config = config
        self.buttons: List[HUDButton] = []
        self.hovered_button: Optional[HUDButton] = None

        # Interaction callbacks
        self.on_mode_click: Optional[Callable[[HUDMode], Any]] = None
        self.on_exit_click: Optional[Callable[[], Any]] = None
        self.on_reset_object: Optional[Callable[[], Any]] = None
        self.on_scale_object: Optional[Callable[[float], Any]] = None
        self.on_switch_cam: Optional[Callable[[int], Any]] = None
        self.on_config_changed: Optional[Callable[[], Any]] = None

    def build_layout(self, w: float, h: float, current_mode: HUDMode):
        """Constructs responsive button geometries for current viewport resolution."""
        self.buttons.clear()

        # 1. Top Navigation Bar Buttons (Modes)
        tab_w = 140.0
        tab_h = 34.0
        # Ensure clearance from left title while staying centered
        centered_x = (w - (4 * tab_w + 3 * 12.0)) * 0.5
        start_x = max(260.0, centered_x)
        top_y = 20.0

        modes = [
            (HUDMode.CORE, "SYSTEM CORE"),
            (HUDMode.OBJECT_3D, "3D OBJECT"),
            (HUDMode.DIAGNOSTICS, "DIAGNOSTICS"),
            (HUDMode.SETTINGS, "SETTINGS")
        ]

        for i, (m, label) in enumerate(modes):
            bx = start_x + i * (tab_w + 12.0)
            btn = HUDButton(
                btn_id=f"mode_{m.value}",
                label=label,
                rect=QRectF(bx, top_y, tab_w, tab_h),
                on_click=lambda m_target=m: self._handle_mode_select(m_target)
            )
            btn.is_active = (current_mode == m)
            self.buttons.append(btn)

        # 2. Window Exit Button (Top Right)
        self.buttons.append(
            HUDButton(
                btn_id="btn_exit",
                label="EXIT [X]",
                rect=QRectF(w - 110.0, top_y, 90.0, tab_h),
                on_click=self._handle_exit
            )
        )

        # 3. Mode-specific buttons in the Right Panel (w - 320 to w - 30)
        panel_x = w - 310.0
        btn_y = 100.0
        btn_w = 280.0
        btn_h = 42.0
        spacing = 14.0

        if current_mode == HUDMode.CORE:
            self.buttons.append(HUDButton("core_mirror", "TOGGLE MIRROR", QRectF(panel_x, btn_y, btn_w, btn_h), self._toggle_mirror))
            self.buttons.append(HUDButton("core_feed", "TOGGLE CAM FEED", QRectF(panel_x, btn_y + (btn_h + spacing), btn_w, btn_h), self._toggle_cam_feed))
            self.buttons.append(HUDButton("core_audio", "TOGGLE AUDIO FX", QRectF(panel_x, btn_y + 2 * (btn_h + spacing), btn_w, btn_h), self._toggle_audio))

        elif current_mode == HUDMode.OBJECT_3D:
            self.buttons.append(HUDButton("obj_reset", "RESET OBJECT", QRectF(panel_x, btn_y, btn_w, btn_h), self._reset_object))
            self.buttons.append(HUDButton("obj_scale_up", "SCALE +25%", QRectF(panel_x, btn_y + (btn_h + spacing), btn_w, btn_h), self._scale_up))
            self.buttons.append(HUDButton("obj_scale_down", "SCALE -25%", QRectF(panel_x, btn_y + 2 * (btn_h + spacing), btn_w, btn_h), self._scale_down))

        elif current_mode == HUDMode.SETTINGS:
            self.buttons.append(HUDButton("set_cam0", "SELECT CAMERA 0", QRectF(panel_x, btn_y, btn_w, btn_h), lambda: self._switch_cam(0)))
            self.buttons.append(HUDButton("set_cam1", "SELECT CAMERA 1", QRectF(panel_x, btn_y + (btn_h + spacing), btn_w, btn_h), lambda: self._switch_cam(1)))
            self.buttons.append(HUDButton("set_sens_up", "SENSITIVITY +", QRectF(panel_x, btn_y + 2 * (btn_h + spacing), btn_w, btn_h), self._sens_up))
            self.buttons.append(HUDButton("set_sens_down", "SENSITIVITY -", QRectF(panel_x, btn_y + 3 * (btn_h + spacing), btn_w, btn_h), self._sens_down))

    def update_hover(self, cursor_x: float, cursor_y: float) -> Optional[HUDButton]:
        """Updates hover states for all interactive buttons."""
        self.hovered_button = None
        for btn in self.buttons:
            if btn.hit_test(cursor_x, cursor_y):
                btn.is_hovered = True
                self.hovered_button = btn
            else:
                btn.is_hovered = False
        return self.hovered_button

    def trigger_click_at(self, cursor_x: float, cursor_y: float) -> Optional[HUDButton]:
        """Dispatches a click on the hovered button if valid."""
        for btn in self.buttons:
            if btn.hit_test(cursor_x, cursor_y):
                if btn.on_click:
                    btn.on_click()
                return btn
        return None

    def _handle_mode_select(self, mode: HUDMode):
        if self.on_mode_click:
            self.on_mode_click(mode)

    def _handle_exit(self):
        if self.on_exit_click:
            self.on_exit_click()

    def _toggle_mirror(self):
        self.config.mirror_camera = not self.config.mirror_camera
        if self.on_config_changed:
            self.on_config_changed()

    def _toggle_cam_feed(self):
        self.config.show_camera_feed = not self.config.show_camera_feed
        if self.on_config_changed:
            self.on_config_changed()

    def _toggle_audio(self):
        self.config.audio_enabled = not self.config.audio_enabled
        if self.on_config_changed:
            self.on_config_changed()

    def _reset_object(self):
        if self.on_reset_object:
            self.on_reset_object()

    def _scale_up(self):
        if self.on_scale_object:
            self.on_scale_object(0.25)

    def _scale_down(self):
        if self.on_scale_object:
            self.on_scale_object(-0.25)

    def _switch_cam(self, cam_id: int):
        if self.on_switch_cam:
            self.on_switch_cam(cam_id)

    def _sens_up(self):
        self.config.cursor_sensitivity = min(3.0, self.config.cursor_sensitivity + 0.2)
        if self.on_config_changed:
            self.on_config_changed()

    def _sens_down(self):
        self.config.cursor_sensitivity = max(0.5, self.config.cursor_sensitivity - 0.2)
        if self.on_config_changed:
            self.on_config_changed()
