"""Lightweight in-process event bus for data-change notifications (Phase 2)."""
import logging
from typing import Callable, Dict, List, Any
from enum import Enum

logger = logging.getLogger("portpulse.event_bus")


class EventType(str, Enum):
    DATA_CHANGED = "data_changed"
    ASSIGNMENT_CHANGED = "assignment_changed"
    AUTO_OPTIMIZE_REQUESTED = "auto_optimize_requested"
    ML_MODELS_RETRAINED = "ml_models_retrained"


class EventBus:
    """Simple synchronous pub/sub event bus for intra-process notifications."""

    def __init__(self):
        self._subscribers: Dict[EventType, List[Callable]] = {}

    def subscribe(self, event_type: EventType, callback: Callable):
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(callback)
        logger.info(f"EventBus: {callback.__name__} subscribed to {event_type.value}")

    def publish(self, event_type: EventType, **kwargs):
        listeners = self._subscribers.get(event_type, [])
        logger.info(
            f"EventBus: Publishing {event_type.value} to {len(listeners)} subscriber(s)",
            extra={"extra_data": kwargs}
        )
        for cb in listeners:
            try:
                cb(**kwargs)
            except Exception as e:
                logger.error(
                    f"EventBus: Subscriber {cb.__name__} failed on {event_type.value}: {e}",
                    exc_info=True
                )


event_bus = EventBus()
