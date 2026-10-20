"""Holographic HUD Rendering Engine
Implements procedural sci-fi graphics, concentric rings, 3D object projection,
hand skeleton overlays, targeting reticles, and glassmorphism panels.
"""
import math
import time
from typing import List, Tuple, Optional
from app.qt_compat import (
    QPainter, QColor, QPen, QBrush, QFont, QPointF, QRectF,
    QPainterPath, QImage, QRadialGradient, QLinearGradient, Qt
)
from app.state import (
    HUDMode, CameraState, HandTrackingData, GestureType,
    VirtualCursorState, VirtualObjectState, SystemTelemetry, Landmark3D
)
from app.configuration import HUDConfiguration
from hud.effects import RingAnimator, ParticleSystem
from hud.panel_manager import PanelManager, HUDButton
from vision.hand_tracker import HAND_CONNECTIONS


class HUDRenderer:
    """Renders the complete holographic HUD interface using PySide6/PyQt6 QPainter."""

    def __init__(self, config: HUDConfiguration):
        self.config = config
        self.animator = RingAnimator()
        self.particles = ParticleSystem(count=40)

        # Color Palette
        self.c_bg_dark = QColor(4, 8, 16, 245)
        self.c_cyan_bright = QColor(0, 235, 255)
        self.c_cyan_dim = QColor(0, 180, 220, 140)
        self.c_blue_glow = QColor(0, 100, 255, 120)
        self.c_white = QColor(245, 250, 255)
        self.c_orange_warn = QColor(255, 170, 0)
        self.c_red_alert = QColor(255, 50, 50)
        self.c_green_ready = QColor(0, 255, 150)

        # Wireframe 3D Arc Reactor Geometry (Vertices & Edges)
        self._init_3d_geometry()

    def _init_3d_geometry(self):
        """Constructs a 3D dual-icosahedron / arc-reactor cage structure."""
        phi = (1.0 + math.sqrt(5.0)) / 2.0
        # 12 vertices of regular icosahedron
        raw_v = [
            (-1, phi, 0), (1, phi, 0), (-1, -phi, 0), (1, -phi, 0),
            (0, -1, phi), (0, 1, phi), (0, -1, -phi), (0, 1, -phi),
            (phi, 0, -1), (phi, 0, 1), (-phi, 0, -1), (-phi, 0, 1)
        ]
        # Normalize to radius 1.0
        self.v_3d: List[Tuple[float, float, float]] = []
        for x, y, z in raw_v:
            r = math.sqrt(x*x + y*y + z*z)
            self.v_3d.append((x / r, y / r, z / r))

        # Distinct edges connecting vertices
        self.edges_3d: List[Tuple[int, int]] = []
        for i in range(len(self.v_3d)):
            for j in range(i + 1, len(self.v_3d)):
                dx = self.v_3d[i][0] - self.v_3d[j][0]
                dy = self.v_3d[i][1] - self.v_3d[j][1]
                dz = self.v_3d[i][2] - self.v_3d[j][2]
                dist = math.sqrt(dx*dx + dy*dy + dz*dz)
                if abs(dist - 1.05) < 0.2:  # Adjacent edges in normalized icosahedron
                    self.edges_3d.append((i, j))

    def update_animations(self):
        """Updates procedural animation accumulators."""
        speed = 1.0 if self.config.effect_intensity == "HIGH" else (0.5 if self.config.effect_intensity == "MEDIUM" else 0.0)
        self.animator.update(speed)
        if speed > 0:
            self.particles.update()

    def render(
        self,
        painter: QPainter,
        width: int,
        height: int,
        camera_frame: Optional[QImage],
        hands: List[HandTrackingData],
        cursor: VirtualCursorState,
        camera_status: str,
        current_mode: HUDMode,
        virtual_object: VirtualObjectState,
        telemetry: SystemTelemetry,
        panel_mgr: PanelManager,
        toast_message: Optional[str] = None
    ):
        """Main render dispatch."""
        painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
        painter.setRenderHint(QPainter.RenderHint.TextAntialiasing, True)

        # 1. Background Grid & Tone
        self._render_background(painter, width, height)

        # 2. Composited Camera Feed
        if self.config.show_camera_feed and camera_frame is not None and not camera_frame.isNull():
            self._render_camera_feed(painter, width, height, camera_frame)

        # 3. Ambient Sci-Fi Dust Particles
        if self.config.effect_intensity != "LOW":
            self._render_particles(painter)

        # 4. Mode-Specific Content (Core vs 3D Object vs Diagnostics vs Settings)
        if current_mode == HUDMode.CORE:
            self._render_system_core(painter, width, height)
        elif current_mode == HUDMode.OBJECT_3D:
            self._render_3d_object(painter, width, height, virtual_object)
        elif current_mode == HUDMode.DIAGNOSTICS:
            self._render_diagnostics_view(painter, width, height, telemetry)
        elif current_mode == HUDMode.SETTINGS:
            self._render_settings_view(painter, width, height)

        # 5. Hand Skeleton & Tracking Reticles
        if self.config.show_skeleton and hands:
            self._render_hands(painter, width, height, hands)

        # 6. UI Overlays (Top Bar, Left Telemetry, Right Panels, Bottom Bar)
        self._render_top_bar(painter, width, height, current_mode)
        self._render_left_telemetry(painter, height, hands, camera_status)
        self._render_interactive_buttons(painter, panel_mgr)
        self._render_bottom_bar(painter, width, height, telemetry)

        # Toast notification banner (e.g. Camera Switch)
        if toast_message:
            self._render_toast(painter, width, toast_message)

        # 7. Virtual Holographic Cursor (Topmost layer)
        self._render_cursor(painter, cursor)

    def _render_background(self, painter: QPainter, w: int, h: int):
        """Draws dark sci-fi background and technical grid."""
        # Deep navy gradient
        grad = QLinearGradient(0, 0, 0, h)
        grad.setColorAt(0.0, QColor(6, 12, 24))
        grad.setColorAt(1.0, QColor(2, 4, 8))
        painter.fillRect(0, 0, w, h, grad)

        # Subtle technical grid lines
        grid_pen = QPen(QColor(0, 180, 255, 18), 1, Qt.PenStyle.DashLine)
        painter.setPen(grid_pen)
        grid_spacing = 60
        for x in range(0, w, grid_spacing):
            painter.drawLine(x, 0, x, h)
        for y in range(0, h, grid_spacing):
            painter.drawLine(0, y, w, y)

    def _render_camera_feed(self, painter: QPainter, w: int, h: int, frame: QImage):
        """Composites the live camera feed with translucent sci-fi shader effect."""
        opacity = self.config.camera_feed_opacity
        painter.setOpacity(opacity)

        # Scale frame to cover or fit viewport
        target_rect = QRectF(0, 0, w, h)
        painter.drawImage(target_rect, frame)

        # Subtle scanline overlay
        painter.setOpacity(0.08)
        scan_pen = QPen(QColor(0, 220, 255), 1)
        painter.setPen(scan_pen)
        for y in range(0, h, 4):
            painter.drawLine(0, y, w, y)

        painter.setOpacity(1.0)

    def _render_particles(self, painter: QPainter):
        """Draws ambient floating holographic particles."""
        painter.setPen(Qt.PenStyle.NoPen)
        for p in self.particles.particles:
            painter.setBrush(QColor(0, 220, 255, int(p.alpha * 255)))
            painter.drawEllipse(QPointF(p.x, p.y), p.size, p.size)

    def _render_top_bar(self, painter: QPainter, w: int, h: int, current_mode: HUDMode):
        """Renders top header, project title, and timecode."""
        # Top bar bracket
        painter.setPen(QPen(self.c_cyan_dim, 1))
        painter.drawLine(30, 65, w - 30, 65)

        # Title and Subtitle stacked cleanly
        painter.setPen(self.c_cyan_bright)
        painter.setFont(QFont("Segoe UI", 11, QFont.Weight.Bold))
        painter.drawText(35, 36, "PROJECT J.A.R.V.I.S.")

        painter.setFont(QFont("Consolas", 8))
        painter.setPen(self.c_cyan_dim)
        now_str = time.strftime("%Y-%m-%d  %H:%M:%S")
        painter.drawText(35, 52, f"TACTICAL HUD // {now_str}")

    def _render_left_telemetry(self, painter: QPainter, h: int, hands: List[HandTrackingData], status_str: str):
        """Renders left telemetry cards: tracking status, gesture badge, confidence."""
        panel_x = 30.0
        panel_y = 90.0
        panel_w = 260.0

        # Background panel
        self._draw_glass_panel(painter, QRectF(panel_x, panel_y, panel_w, 280.0), "TRACKING TELEMETRY")

        # Status Pill
        pill_rect = QRectF(panel_x + 15, panel_y + 35, panel_w - 30, 32)
        if status_str == CameraState.HAND_TRACKED.value:
            fill_col = QColor(0, 255, 150, 40)
            border_col = self.c_green_ready
            dot_col = self.c_green_ready
        elif status_str == CameraState.SEARCHING_FOR_HAND.value:
            fill_col = QColor(255, 170, 0, 35)
            border_col = self.c_orange_warn
            dot_col = self.c_orange_warn
        else:
            fill_col = QColor(255, 50, 50, 35)
            border_col = self.c_red_alert
            dot_col = self.c_red_alert

        painter.setBrush(fill_col)
        painter.setPen(QPen(border_col, 1))
        painter.drawRoundedRect(pill_rect, 4, 4)

        # Status dot & text
        painter.setBrush(dot_col)
        painter.setPen(Qt.PenStyle.NoPen)
        painter.drawEllipse(QPointF(pill_rect.left() + 14, pill_rect.center().y()), 4, 4)

        painter.setPen(self.c_white)
        painter.setFont(QFont("Consolas", 9, QFont.Weight.Bold))
        painter.drawText(QRectF(pill_rect.left() + 26, pill_rect.top(), pill_rect.width() - 30, pill_rect.height()), Qt.AlignmentFlag.AlignVCenter, status_str)

        # Hand details
        has_hand = len(hands) > 0
        primary = hands[0] if has_hand else None

        row_y = panel_y + 85
        painter.setFont(QFont("Consolas", 9))
        painter.setPen(self.c_cyan_dim)
        painter.drawText(int(panel_x + 15), int(row_y), "ACTIVE HAND:")
        painter.setPen(self.c_white)
        painter.drawText(int(panel_x + 130), int(row_y), primary.handedness.upper() if primary else "NONE")

        row_y += 26
        painter.setPen(self.c_cyan_dim)
        painter.drawText(int(panel_x + 15), int(row_y), "CONFIDENCE:")
        conf = int((primary.confidence * 100) if primary else 0)
        painter.setPen(self.c_cyan_bright)
        painter.drawText(int(panel_x + 130), int(row_y), f"{conf}%")

        # Confidence bar
        row_y += 10
        painter.setBrush(QColor(0, 50, 80))
        painter.setPen(QPen(self.c_cyan_dim, 1))
        bar_w = panel_w - 30
        painter.drawRect(QRectF(panel_x + 15, row_y, bar_w, 6))
        painter.setBrush(self.c_cyan_bright)
        painter.drawRect(QRectF(panel_x + 15, row_y, bar_w * (conf / 100.0), 6))

        # Gesture Badge
        row_y += 30
        painter.setPen(self.c_cyan_dim)
        painter.drawText(int(panel_x + 15), int(row_y), "CURRENT GESTURE:")
        row_y += 18
        gesture_str = primary.gesture.value if (primary and hasattr(primary, "gesture")) else "IDLE"
        if primary and primary.is_pinching:
            gesture_str = "PINCHING"

        # Badge box
        painter.setBrush(QColor(0, 150, 255, 30))
        painter.setPen(QPen(self.c_cyan_bright, 1))
        painter.drawRect(QRectF(panel_x + 15, row_y, bar_w, 28))
        painter.setPen(self.c_white)
        painter.setFont(QFont("Consolas", 10, QFont.Weight.Bold))
        painter.drawText(QRectF(panel_x + 15, row_y, bar_w, 28), Qt.AlignmentFlag.AlignCenter, gesture_str)

        # Pinch metric
        row_y += 42
        painter.setFont(QFont("Consolas", 8))
        pinch_val = primary.pinch_distance if primary else 1.0
        painter.setPen(self.c_cyan_dim)
        painter.drawText(int(panel_x + 15), int(row_y), f"PINCH DIST: {pinch_val:.3f} (ENGAGE < 0.048)")

    def _render_interactive_buttons(self, painter: QPainter, panel_mgr: PanelManager):
        """Renders interactive sci-fi buttons with hover and active states."""
        for btn in panel_mgr.buttons:
            rect = btn.rect

            # Determine button appearance
            if btn.is_pressed:
                fill_color = QColor(0, 235, 255, 90)
                border_color = self.c_white
                text_color = self.c_white
            elif btn.is_active:
                fill_color = QColor(0, 180, 255, 60)
                border_color = self.c_cyan_bright
                text_color = self.c_white
            elif btn.is_hovered:
                fill_color = QColor(0, 200, 255, 40)
                border_color = self.c_cyan_bright
                text_color = self.c_cyan_bright
            else:
                fill_color = QColor(6, 16, 32, 160)
                border_color = self.c_cyan_dim
                text_color = QColor(180, 220, 255)

            # Draw button background
            painter.setBrush(fill_color)
            painter.setPen(QPen(border_color, 1))
            painter.drawRect(rect)

            # Technical corner brackets
            cw = 5.0
            painter.setPen(QPen(self.c_cyan_bright, 1.5))
            painter.drawLine(QPointF(rect.left(), rect.top()), QPointF(rect.left() + cw, rect.top()))
            painter.drawLine(QPointF(rect.left(), rect.top()), QPointF(rect.left(), rect.top() + cw))
            painter.drawLine(QPointF(rect.right(), rect.bottom()), QPointF(rect.right() - cw, rect.bottom()))
            painter.drawLine(QPointF(rect.right(), rect.bottom()), QPointF(rect.right(), rect.bottom() - cw))

            # Button text
            painter.setFont(QFont("Consolas", 9, QFont.Weight.Bold))
            painter.setPen(text_color)
            painter.drawText(rect, Qt.AlignmentFlag.AlignCenter, btn.label)

    def _render_system_core(self, painter: QPainter, w: int, h: int):
        """Renders the central Iron Man Arc Reactor with rotating rings and radial ticks."""
        cx = w * 0.5
        cy = h * 0.5 + 15.0

        painter.save()
        painter.translate(cx, cy)

        # Pulse glow
        pulse = self.animator.pulse
        glow_grad = QRadialGradient(0, 0, 180 * pulse)
        glow_grad.setColorAt(0.0, QColor(0, 235, 255, int(90 * pulse)))
        glow_grad.setColorAt(0.4, QColor(0, 100, 255, int(40 * pulse)))
        glow_grad.setColorAt(1.0, QColor(0, 0, 0, 0))
        painter.setBrush(glow_grad)
        painter.setPen(Qt.PenStyle.NoPen)
        painter.drawEllipse(QPointF(0, 0), 180 * pulse, 180 * pulse)

        # Outer Ring with ticks
        painter.save()
        painter.rotate(self.animator.angle_slow)
        painter.setPen(QPen(self.c_cyan_dim, 1))
        painter.drawEllipse(QPointF(0, 0), 190, 190)
        # Radial ticks
        for i in range(0, 360, 10):
            rad = math.radians(i)
            r1 = 184 if (i % 30 == 0) else 187
            r2 = 196
            painter.drawLine(QPointF(r1 * math.cos(rad), r1 * math.sin(rad)), QPointF(r2 * math.cos(rad), r2 * math.sin(rad)))
        painter.restore()

        # Middle Segmented Arcs
        painter.save()
        painter.rotate(self.animator.angle_medium)
        painter.setPen(QPen(self.c_cyan_bright, 3))
        for start_ang in [0, 90, 180, 270]:
            painter.drawArc(QRectF(-140, -140, 280, 280), (start_ang + 10) * 16, 70 * 16)
        painter.restore()

        # Inner Fast Ring
        painter.save()
        painter.rotate(self.animator.angle_fast)
        painter.setPen(QPen(self.c_white, 1.5, Qt.PenStyle.DashLine))
        painter.drawEllipse(QPointF(0, 0), 95, 95)
        # 10 Coils around inner core
        for i in range(10):
            ang = math.radians(i * 36)
            painter.setBrush(QColor(0, 200, 255, 180))
            painter.setPen(QPen(self.c_white, 1))
            painter.drawRoundedRect(QRectF(70 * math.cos(ang) - 6, 70 * math.sin(ang) - 6, 12, 12), 2, 2)
        painter.restore()

        # Central Palladium Core
        core_grad = QRadialGradient(0, 0, 45)
        core_grad.setColorAt(0.0, self.c_white)
        core_grad.setColorAt(0.5, self.c_cyan_bright)
        core_grad.setColorAt(1.0, QColor(0, 120, 255, 180))
        painter.setBrush(core_grad)
        painter.setPen(QPen(self.c_white, 2))
        painter.drawEllipse(QPointF(0, 0), 45, 45)

        # Core Label
        painter.setFont(QFont("Consolas", 8, QFont.Weight.Bold))
        painter.setPen(QColor(4, 12, 24))
        painter.drawText(QRectF(-40, -10, 80, 20), Qt.AlignmentFlag.AlignCenter, "MARK VII")

        painter.restore()

    def _render_3d_object(self, painter: QPainter, w: int, h: int, obj: VirtualObjectState):
        """Renders interactive 3D holographic wireframe object rotatable via gestures."""
        cx = w * 0.5
        cy = h * 0.5 + 15.0

        painter.save()
        painter.translate(cx, cy)

        # Interactive Grab Ring Indicator
        glow_color = self.c_cyan_bright if obj.is_grabbed else self.c_cyan_dim
        painter.setPen(QPen(glow_color, 2 if obj.is_grabbed else 1, Qt.PenStyle.DashDotLine))
        painter.drawEllipse(QPointF(0, 0), 160 * obj.scale, 160 * obj.scale)

        # 3D Rotation Math
        rx = math.radians(obj.rotation_x)
        ry = math.radians(obj.rotation_y)
        rz = math.radians(obj.rotation_z)

        # Precompute rotation matrix
        cx_val, sx_val = math.cos(rx), math.sin(rx)
        cy_val, sy_val = math.cos(ry), math.sin(ry)
        cz_val, sz_val = math.cos(rz), math.sin(rz)

        projected_2d: List[QPointF] = []
        base_scale = 120.0 * obj.scale

        for vx, vy, vz in self.v_3d:
            # Rotate Y
            x1 = vx * cy_val + vz * sy_val
            y1 = vy
            z1 = -vx * sy_val + vz * cy_val

            # Rotate X
            x2 = x1
            y2 = y1 * cx_val - z1 * sx_val
            z2 = y1 * sx_val + z1 * cx_val

            # Perspective projection (camera at z = 3.0)
            fov_factor = 2.5 / (2.5 + z2)
            px = x2 * base_scale * fov_factor
            py = y2 * base_scale * fov_factor
            projected_2d.append(QPointF(px, py))

        # Draw wireframe edges
        edge_pen = QPen(self.c_cyan_bright if obj.is_grabbed else QColor(0, 200, 255, 200), 1.5)
        painter.setPen(edge_pen)
        for i, j in self.edges_3d:
            painter.drawLine(projected_2d[i], projected_2d[j])

        # Draw vertex nodes
        painter.setPen(Qt.PenStyle.NoPen)
        for p in projected_2d:
            painter.setBrush(self.c_white)
            painter.drawEllipse(p, 3.5, 3.5)

        # Center indicator
        painter.setBrush(self.c_cyan_bright)
        painter.drawEllipse(QPointF(0, 0), 6, 6)

        # Hint text
        painter.setFont(QFont("Consolas", 9))
        painter.setPen(self.c_cyan_dim)
        drag_state_str = "OBJECT LOCKED [PINCH ACTIVE]" if obj.is_grabbed else "PINCH & DRAG TO ROTATE // TWO HANDS TO SCALE"
        painter.drawText(QRectF(-200, 180, 400, 30), Qt.AlignmentFlag.AlignCenter, drag_state_str)

        painter.restore()

    def _render_diagnostics_view(self, painter: QPainter, w: int, h: int, telem: SystemTelemetry):
        """Renders comprehensive real-time system performance telemetry in center canvas."""
        cx = w * 0.5 - 200.0
        cy = 130.0

        card_w = 400.0
        card_h = 360.0
        self._draw_glass_panel(painter, QRectF(cx, cy, card_w, card_h), "HARDWARE & SENSOR DIAGNOSTICS")

        rows = [
            ("CAMERA INPUT:", telem.active_camera_name),
            ("CAPTURE RESOLUTION:", f"{telem.frame_width} x {telem.frame_height}"),
            ("CAMERA FPS:", f"{telem.camera_fps:.1f} FPS"),
            ("RENDER ENGINE FPS:", f"{telem.render_fps:.1f} FPS"),
            ("INFERENCE LATENCY:", f"{telem.inference_time_ms:.1f} ms"),
            ("TOTAL FRAME LATENCY:", f"{telem.total_frame_latency_ms:.1f} ms"),
            ("SYSTEM CPU USAGE:", f"{telem.cpu_percent:.1f}%"),
            ("SYSTEM RAM USAGE:", f"{telem.ram_percent:.1f}%"),
            ("HANDS DETECTED:", str(telem.hands_detected))
        ]

        start_y = cy + 45.0
        painter.setFont(QFont("Consolas", 10))

        for label, val in rows:
            painter.setPen(self.c_cyan_dim)
            painter.drawText(int(cx + 25), int(start_y), label)
            painter.setPen(self.c_white)
            painter.drawText(int(cx + 220), int(start_y), val)
            start_y += 32.0

    def _render_settings_view(self, painter: QPainter, w: int, h: int):
        """Renders settings summary card."""
        cx = w * 0.5 - 220.0
        cy = 130.0
        self._draw_glass_panel(painter, QRectF(cx, cy, 440.0, 340.0), "CONFIGURATION OVERVIEW")

        items = [
            ("PRIMARY CAMERA ID:", f"Device #{self.config.camera_id}"),
            ("MIRROR PREVIEW:", "ENABLED" if self.config.mirror_camera else "DISABLED"),
            ("CURSOR SENSITIVITY:", f"{self.config.cursor_sensitivity:.1f}x"),
            ("PINCH ENGAGE THRESHOLD:", f"{self.config.pinch_engage_threshold:.3f}"),
            ("PINCH RELEASE THRESHOLD:", f"{self.config.pinch_release_threshold:.3f}"),
            ("AUDIO FEEDBACK:", "ACTIVE" if self.config.audio_enabled else "MUTED"),
            ("BACKGROUND CAMERA FEED:", "VISIBLE" if self.config.show_camera_feed else "HIDDEN")
        ]

        start_y = cy + 50.0
        painter.setFont(QFont("Consolas", 10))
        for label, val in items:
            painter.setPen(self.c_cyan_dim)
            painter.drawText(int(cx + 20), int(start_y), label)
            painter.setPen(self.c_cyan_bright)
            painter.drawText(int(cx + 250), int(start_y), val)
            start_y += 38.0

    def _render_hands(self, painter: QPainter, w: int, h: int, hands: List[HandTrackingData]):
        """Renders 21-joint skeleton, bone vectors, and targeting reticles on detected hands."""
        for hand in hands:
            if len(hand.landmarks) < 21:
                continue

            # Convert normalized coordinates to screen space
            pts: List[QPointF] = []
            for lm in hand.landmarks:
                pts.append(QPointF(lm.x * w, lm.y * h))

            # 1. Bone connections (electric blue vector lines)
            painter.setPen(QPen(QColor(0, 120, 255, 180), 2))
            for i1, i2 in HAND_CONNECTIONS:
                painter.drawLine(pts[i1], pts[i2])

            # 2. Joint Nodes
            for idx, pt in enumerate(pts):
                # Highlights on fingertips (4, 8, 12, 16, 20)
                if idx in (4, 8, 12, 16, 20):
                    painter.setBrush(self.c_white)
                    painter.setPen(QPen(self.c_cyan_bright, 1.5))
                    painter.drawEllipse(pt, 5, 5)
                else:
                    painter.setBrush(self.c_cyan_bright)
                    painter.setPen(Qt.PenStyle.NoPen)
                    painter.drawEllipse(pt, 3, 3)

            # 3. Targeting Brackets around Index Tip (8)
            tip_pt = pts[8]
            painter.setPen(QPen(self.c_cyan_bright, 1.5))
            painter.setBrush(Qt.BrushStyle.NoBrush)
            r = 14.0
            painter.drawEllipse(tip_pt, r, r)

            # 4. Pinch Vector between thumb (4) and index (8)
            thumb_pt = pts[4]
            pinch_col = self.c_white if hand.is_pinching else QColor(0, 255, 200, 160)
            painter.setPen(QPen(pinch_col, 2 if hand.is_pinching else 1, Qt.PenStyle.DashLine))
            painter.drawLine(thumb_pt, tip_pt)

    def _render_cursor(self, painter: QPainter, cursor: VirtualCursorState):
        """Renders the top-level holographic cursor reticle."""
        if not cursor.is_active:
            return

        cx = cursor.screen_x
        cy = cursor.screen_y

        painter.save()
        painter.translate(cx, cy)

        # Pulse angle
        painter.rotate(self.animator.angle_fast)

        cursor_col = self.c_white if cursor.is_clicking else self.c_cyan_bright
        reticle_r = 12.0 if cursor.is_clicking else 18.0

        # Center dot
        painter.setBrush(cursor_col)
        painter.setPen(Qt.PenStyle.NoPen)
        painter.drawEllipse(QPointF(0, 0), 3.0, 3.0)

        # Reticle ring
        painter.setBrush(Qt.BrushStyle.NoBrush)
        painter.setPen(QPen(cursor_col, 2))
        painter.drawEllipse(QPointF(0, 0), reticle_r, reticle_r)

        # Brackets
        b_len = 6.0
        for angle in [0, 90, 180, 270]:
            painter.save()
            painter.rotate(angle)
            painter.drawLine(QPointF(reticle_r + 2, 0), QPointF(reticle_r + 2 + b_len, 0))
            painter.restore()

        # Click shockwave if clicking
        if cursor.is_clicking:
            painter.setPen(QPen(QColor(0, 255, 200, 180), 1))
            painter.drawEllipse(QPointF(0, 0), reticle_r + 10, reticle_r + 10)

        painter.restore()

    def _render_bottom_bar(self, painter: QPainter, w: int, h: int, telem: SystemTelemetry):
        """Renders bottom status line and interaction guide."""
        bottom_y = h - 35.0

        # Technical line
        painter.setPen(QPen(self.c_cyan_dim, 1))
        painter.drawLine(30, int(bottom_y), w - 30, int(bottom_y))

        # Telemetry metrics
        metrics_str = f"FPS: {telem.render_fps:.1f} | CAM: {telem.camera_fps:.1f} | INFER: {telem.inference_time_ms:.1f}ms | CPU: {telem.cpu_percent:.0f}% | RAM: {telem.ram_percent:.0f}%"
        painter.setFont(QFont("Consolas", 8, QFont.Weight.Bold))
        painter.setPen(self.c_cyan_dim)
        painter.drawText(35, int(bottom_y + 20), metrics_str)

        # Interaction hint
        hint_str = "CONTROLS: POINT = CURSOR | PINCH = SELECT | C / [0-2] = SWITCH CAM | SWIPE = MODE | ESC = EXIT"
        painter.setPen(self.c_white)
        painter.drawText(QRectF(w - 750, bottom_y + 8, 715, 20), Qt.AlignmentFlag.AlignRight, hint_str)

    def _render_toast(self, painter: QPainter, w: int, message: str):
        """Renders an animated sci-fi notification banner."""
        banner_w = 420.0
        banner_h = 36.0
        bx = (w - banner_w) * 0.5
        by = 78.0

        rect = QRectF(bx, by, banner_w, banner_h)
        painter.setBrush(QColor(0, 30, 60, 225))
        painter.setPen(QPen(self.c_cyan_bright, 1.5))
        painter.drawRect(rect)

        # Technical edge brackets
        bw = 8.0
        painter.setPen(QPen(self.c_white, 2))
        painter.drawLine(QPointF(rect.left(), rect.top()), QPointF(rect.left() + bw, rect.top()))
        painter.drawLine(QPointF(rect.left(), rect.top()), QPointF(rect.left(), rect.top() + bw))
        painter.drawLine(QPointF(rect.right(), rect.bottom()), QPointF(rect.right() - bw, rect.bottom()))
        painter.drawLine(QPointF(rect.right(), rect.bottom()), QPointF(rect.right(), rect.bottom() - bw))

        painter.setFont(QFont("Consolas", 10, QFont.Weight.Bold))
        painter.setPen(self.c_cyan_bright)
        painter.drawText(rect, Qt.AlignmentFlag.AlignCenter, message)

    def _draw_glass_panel(self, painter: QPainter, rect: QRectF, title: str):
        """Helper to draw a sci-fi translucent glass card with glowing tech borders."""
        # Glass fill
        painter.setBrush(QColor(6, 14, 28, 200))
        painter.setPen(QPen(self.c_cyan_dim, 1))
        painter.drawRect(rect)

        # Top title bar
        header_rect = QRectF(rect.left(), rect.top(), rect.width(), 24.0)
        painter.setBrush(QColor(0, 150, 255, 35))
        painter.setPen(QPen(self.c_cyan_bright, 1))
        painter.drawRect(header_rect)

        # Title text
        painter.setFont(QFont("Consolas", 8, QFont.Weight.Bold))
        painter.setPen(self.c_cyan_bright)
        painter.drawText(header_rect.adjusted(10, 0, -10, 0), Qt.AlignmentFlag.AlignVCenter, title)

        # Angled corner accent
        painter.setPen(QPen(self.c_cyan_bright, 2))
        painter.drawLine(QPointF(rect.right() - 8, rect.bottom()), QPointF(rect.right(), rect.bottom() - 8))
