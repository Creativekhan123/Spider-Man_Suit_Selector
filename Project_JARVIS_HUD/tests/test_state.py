"""Unit tests for configuration manager and command service allowlisting."""
import sys
import os
import tempfile
import shutil

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pytest
except ImportError:
    pytest = None

from app.configuration import ConfigurationManager, HUDConfiguration
from services.command_service import CommandService
from app.state import HUDMode


def test_configuration_defaults(tmp_path=None):
    temp_dir = None
    if tmp_path is None:
        temp_dir = tempfile.mkdtemp()
        cfg_file = os.path.join(temp_dir, "test_config.json")
    else:
        cfg_file = str(tmp_path / "test_config.json")

    mgr = ConfigurationManager(config_file=str(cfg_file))
    cfg = mgr.get()

    assert cfg.camera_id == 0
    assert cfg.cursor_sensitivity == 1.3
    assert cfg.pinch_engage_threshold == 0.048
    assert os.path.exists(cfg_file)

    if temp_dir is not None:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_configuration_update(tmp_path=None):
    temp_dir = None
    if tmp_path is None:
        temp_dir = tempfile.mkdtemp()
        cfg_file = os.path.join(temp_dir, "test_config.json")
    else:
        cfg_file = str(tmp_path / "test_config.json")

    mgr = ConfigurationManager(config_file=str(cfg_file))
    mgr.update(cursor_sensitivity=2.5, mirror_camera=False)

    # Re-read from disk
    mgr2 = ConfigurationManager(config_file=str(cfg_file))
    cfg2 = mgr2.get()
    assert cfg2.cursor_sensitivity == 2.5
    assert not cfg2.mirror_camera

    if temp_dir is not None:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_command_service_allowlist():
    cmd_service = CommandService()
    executed_log = []

    cmd_service.register("test_action", lambda arg: executed_log.append(arg))

    # Allowed command
    ok, msg = cmd_service.execute("test_action", arg="system_online")
    assert ok
    assert executed_log == ["system_online"]

    # Disallowed / Unregistered command
    ok_bad, msg_bad = cmd_service.execute("unregistered_command")
    assert not ok_bad
    assert "Command not in allowlist" in msg_bad


if __name__ == "__main__":
    test_configuration_defaults()
    test_configuration_update()
    test_command_service_allowlist()
    print("All configuration and command service tests passed successfully!")
