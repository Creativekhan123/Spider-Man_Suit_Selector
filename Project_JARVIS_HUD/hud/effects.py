"""HUD Visual Effects & Procedural Generators
Manages rotation animators, radar sweeps, and sci-fi ambient particles.
"""
import math
import random
import time
from typing import List, Tuple
from app.qt_compat import QColor, QPointF


class Particle:
    """Ambient holographic dust particle."""

    def __init__(self, w: float, h: float):
        self.w = w
        self.h = h
        self.reset()

    def reset(self):
        self.x = random.uniform(0, self.w)
        self.y = random.uniform(0, self.h)
        self.vx = random.uniform(-0.3, 0.3)
        self.vy = random.uniform(-0.8, -0.2)
        self.size = random.uniform(1.0, 2.5)
        self.alpha = random.uniform(0.1, 0.5)

    def update(self):
        self.x += self.vx
        self.y += self.vy
        if self.y < 0 or self.x < 0 or self.x > self.w:
            self.reset()
            self.y = self.h


class ParticleSystem:
    """Manages ambient holographic background particles."""

    def __init__(self, count: int = 35, width: float = 1280, height: float = 720):
        self.count = count
        self.particles = [Particle(width, height) for _ in range(count)]

    def resize(self, width: float, height: float):
        for p in self.particles:
            p.w = width
            p.h = height

    def update(self):
        for p in self.particles:
            p.update()


class RingAnimator:
    """Maintains continuous angles for concentric HUD rings."""

    def __init__(self):
        self.angle_fast = 0.0
        self.angle_medium = 0.0
        self.angle_slow = 0.0
        self.pulse = 0.0
        self.last_time = time.perf_counter()

    def update(self, speed_multiplier: float = 1.0):
        now = time.perf_counter()
        dt = now - self.last_time
        self.last_time = now

        # Angles in degrees
        self.angle_fast = (self.angle_fast + 45.0 * dt * speed_multiplier) % 360.0
        self.angle_medium = (self.angle_medium - 25.0 * dt * speed_multiplier) % 360.0
        self.angle_slow = (self.angle_slow + 12.0 * dt * speed_multiplier) % 360.0
        self.pulse = 0.85 + 0.15 * math.sin(now * 3.0)
