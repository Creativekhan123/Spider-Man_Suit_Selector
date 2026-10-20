"""Unit tests for tracking filters (EMA and One-Euro)."""
import sys
import os
import time

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pytest
except ImportError:
    pytest = None

from vision.tracking_filter import EMAFilter, OneEuroFilter, PointSmoother2D


def test_ema_filter_basic():
    ema = EMAFilter(alpha=0.5)
    # First point should return initial values
    p1 = ema.filter([10.0, 20.0])
    assert p1 == [10.0, 20.0]

    # Second point should blend 50%
    p2 = ema.filter([20.0, 40.0])
    assert p2 == [15.0, 30.0]

    ema.reset()
    p3 = ema.filter([5.0, 5.0])
    assert p3 == [5.0, 5.0]


def test_ema_filter_alpha_bounds():
    ema = EMAFilter(alpha=1.5)
    assert ema.alpha == 1.0
    ema.set_alpha(-0.5)
    assert ema.alpha == 0.01


def test_one_euro_filter_jitter_reduction():
    smoother = PointSmoother2D(min_cutoff=1.0, beta=0.01)

    t0 = 1000.0
    # Feed stationary signal with high-frequency noise
    base_x, base_y = 0.5, 0.5
    raw_points = []
    smoothed_points = []

    for i in range(20):
        t = t0 + i * 0.033  # ~30 FPS
        noise = 0.02 if (i % 2 == 0) else -0.02
        rx = base_x + noise
        ry = base_y + noise
        raw_points.append((rx, ry))
        sx, sy = smoother.smooth(rx, ry, timestamp=t)
        smoothed_points.append((sx, sy))

    # Variance of smoothed points should be significantly less than raw noise
    raw_deviations = [abs(p[0] - base_x) for p in raw_points[5:]]
    smooth_deviations = [abs(p[0] - base_x) for p in smoothed_points[5:]]

    assert sum(smooth_deviations) / len(smooth_deviations) < sum(raw_deviations) / len(raw_deviations)


def test_smoother_reset():
    smoother = PointSmoother2D()
    s1, s2 = smoother.smooth(0.1, 0.2, timestamp=1.0)
    assert s1 == 0.1
    smoother.reset()
    assert smoother.filter_x.last_time is None


if __name__ == "__main__":
    test_ema_filter_basic()
    test_ema_filter_alpha_bounds()
    test_one_euro_filter_jitter_reduction()
    test_smoother_reset()
    print("All tracking filter tests passed successfully!")
