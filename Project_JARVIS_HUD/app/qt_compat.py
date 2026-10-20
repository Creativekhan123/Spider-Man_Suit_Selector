# pyright: reportMissingImports=false
# type: ignore
"""Qt Compatibility Layer
Supports both PySide6 and PyQt6 transparently.
"""
import sys

try:
    from PySide6 import QtCore, QtGui, QtWidgets
    from PySide6.QtCore import Signal, Slot, QPointF, QRectF, QTimer, Qt, QThread, QSize
    from PySide6.QtGui import QPainter, QColor, QPen, QBrush, QFont, QPainterPath, QImage, QPixmap, QRadialGradient, QLinearGradient
    from PySide6.QtWidgets import QApplication, QMainWindow, QWidget, QLabel, QVBoxLayout, QHBoxLayout, QPushButton
    QT_BINDING = "PySide6"
except ImportError:
    from PyQt6 import QtCore, QtGui, QtWidgets
    from PyQt6.QtCore import pyqtSignal as Signal, pyqtSlot as Slot, QPointF, QRectF, QTimer, Qt, QThread, QSize
    from PyQt6.QtGui import QPainter, QColor, QPen, QBrush, QFont, QPainterPath, QImage, QPixmap, QRadialGradient, QLinearGradient
    from PyQt6.QtWidgets import QApplication, QMainWindow, QWidget, QLabel, QVBoxLayout, QHBoxLayout, QPushButton
    QT_BINDING = "PyQt6"

__all__ = [
    "QtCore", "QtGui", "QtWidgets", "Signal", "Slot",
    "QPointF", "QRectF", "QTimer", "Qt", "QThread", "QSize",
    "QPainter", "QColor", "QPen", "QBrush", "QFont", "QPainterPath",
    "QImage", "QPixmap", "QRadialGradient", "QLinearGradient",
    "QApplication", "QMainWindow", "QWidget", "QLabel", "QVBoxLayout", "QHBoxLayout", "QPushButton",
    "QT_BINDING"
]
