"""Temporal Landmark Smoothing Filters
Provides Exponential Moving Average (EMA) and One-Euro filters to eliminate
high-frequency jitter while preserving fast responsiveness for cursor tracking.
"""
import math
import time
from typing import List, Tuple, Optional


class EMAFilter:
    """Exponential Moving Average filter for 2D/3D points."""

    def __init__(self, alpha: float = 0.45):
        self.alpha = max(0.01, min(1.0, alpha))
        self.state: Optional[List[float]] = None

    def set_alpha(self, alpha: float):
        self.alpha = max(0.01, min(1.0, alpha))

    def filter(self, values: List[float]) -> List[float]:
        if self.state is None:
            self.state = list(values)
            return list(values)

        smoothed = []
        for curr, prev in zip(values, self.state):
            s = self.alpha * curr + (1.0 - self.alpha) * prev
            smoothed.append(s)

        self.state = smoothed
        return list(smoothed)

    def reset(self):
        self.state = None


class LowPassFilter:
    """Helper low-pass filter used in OneEuroFilter."""

    def __init__(self, alpha: float = 1.0):
        self.alpha = alpha
        self.y: Optional[float] = None

    def filter(self, value: float, alpha: Optional[float] = None) -> float:
        if alpha is not None:
            self.alpha = alpha
        if self.y is None:
            self.y = value
            return value
        self.y = self.alpha * value + (1.0 - self.alpha) * self.y
        return self.y

    def reset(self):
        self.y = None


class OneEuroFilter:
    """1-Euro filter for adaptive jitter reduction.
    At low speeds, filters aggressively to eliminate jitter.
    At high speeds, reduces filtering to minimize lag.
    """

    def __init__(self, min_cutoff: float = 1.0, beta: float = 0.007, d_cutoff: float = 1.0):
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff

        self.x_filter = LowPassFilter()
        self.dx_filter = LowPassFilter()
        self.last_time: Optional[float] = None

    def _alpha(self, cutoff: float, dt: float) -> float:
        tau = 1.0 / (2.0 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def filter(self, value: float, timestamp: Optional[float] = None) -> float:
        curr_time = timestamp if timestamp is not None else time.time()

        if self.last_time is None or curr_time <= self.last_time:
            self.last_time = curr_time
            return self.x_filter.filter(value)

        dt = curr_time - self.last_time
        self.last_time = curr_time

        prev_x = self.x_filter.y
        dx = 0.0 if prev_x is None else (value - prev_x) / dt
        edx = self.dx_filter.filter(dx, self._alpha(self.d_cutoff, dt))

        cutoff = self.min_cutoff + self.beta * abs(edx)
        return self.x_filter.filter(value, self._alpha(cutoff, dt))

    def reset(self):
        self.x_filter.reset()
        self.dx_filter.reset()
        self.last_time = None


class PointSmoother2D:
    """2D Coordinate smoother combining One-Euro filtering for X and Y."""

    def __init__(self, min_cutoff: float = 1.2, beta: float = 0.05):
        self.filter_x = OneEuroFilter(min_cutoff=min_cutoff, beta=beta)
        self.filter_y = OneEuroFilter(min_cutoff=min_cutoff, beta=beta)

    def smooth(self, x: float, y: float, timestamp: Optional[float] = None) -> Tuple[float, float]:
        sx = self.filter_x.filter(x, timestamp)
        sy = self.filter_y.filter(y, timestamp)
        return sx, sy

    def reset(self):
        self.filter_x.reset()
        self.filter_y.reset()
