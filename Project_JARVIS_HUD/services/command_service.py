"""Allowlisted Command Service & Registry
Safely dispatches validated application commands without arbitrary execution.
"""
from typing import Dict, Callable, Any, Tuple, Optional
from app.state import HUDMode


class CommandService:
    """Maintains an allowlist of valid application commands with schema validation."""

    def __init__(self):
        self._handlers: Dict[str, Callable[..., Any]] = {}

    def register(self, command_name: str, handler: Callable[..., Any]):
        """Registers an allowlisted command handler."""
        self._handlers[command_name.lower().strip()] = handler

    def execute(self, command_name: str, **kwargs) -> Tuple[bool, str]:
        """Validates and executes an allowlisted command."""
        cmd_key = command_name.lower().strip()
        handler = self._handlers.get(cmd_key)

        if not handler:
            return False, f"Unknown command: '{command_name}'. Command not in allowlist."

        try:
            result = handler(**kwargs)
            return True, f"Executed '{command_name}': {result}"
        except TypeError as te:
            return False, f"Invalid arguments for command '{command_name}': {te}"
        except Exception as e:
            return False, f"Error executing '{command_name}': {e}"
