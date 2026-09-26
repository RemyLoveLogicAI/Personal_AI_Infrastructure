"""Task Queue Implementation with Circuit Breakers & Plateau Detection.

Manages execution cycles in the Personal AI Infrastructure, preventing infinite
Evaluator-Optimizer loops and detecting score plateaus before resource exhaustion.
"""

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional
import time

try:
    from .config import (
        DEFAULT_MAX_ITERATIONS,
        DEFAULT_PLATEAU_THRESHOLD,
        DEFAULT_PLATEAU_CYCLES,
    )
except ImportError:
    from config import (
        DEFAULT_MAX_ITERATIONS,
        DEFAULT_PLATEAU_THRESHOLD,
        DEFAULT_PLATEAU_CYCLES,
    )


@dataclass
class Task:
    id: int
    description: str
    status: str = "Pending"
    iteration_count: int = 0
    scores: List[float] = field(default_factory=list)
    generator_id: Optional[str] = None
    evaluator_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)


class TaskQueue:
    def __init__(
        self,
        max_iterations: int = DEFAULT_MAX_ITERATIONS,
        plateau_threshold: float = DEFAULT_PLATEAU_THRESHOLD,
        plateau_cycles: int = DEFAULT_PLATEAU_CYCLES,
        escalation_handler: Optional[Callable[[Task, str, Dict[str, Any]], None]] = None,
    ):
        self.tasks: List[Task] = []
        self.max_iterations = max_iterations
        self.plateau_threshold = plateau_threshold
        self.plateau_cycles = plateau_cycles
        self.escalation_handler = escalation_handler

    def add_task(
        self,
        description: str,
        generator_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> int:
        """Add a new task and return its task_id (maintains backwards compatibility)."""
        task_id = len(self.tasks)
        task = Task(
            id=task_id,
            description=description,
            status="Pending",
            generator_id=generator_id,
            metadata=metadata or {},
        )
        self.tasks.append(task)
        return task_id

    def get_task(self, task_id: int) -> Optional[Task]:
        """Retrieve task by id."""
        if 0 <= task_id < len(self.tasks):
            return self.tasks[task_id]
        return None

    def get_task_status(self, task_id: int) -> Optional[str]:
        """Get status string for backward compatibility."""
        task = self.get_task(task_id)
        return task.status if task else None

    def update_task_status(self, task_id: int, status: str) -> bool:
        """Update task status."""
        task = self.get_task(task_id)
        if task:
            task.status = status
            task.updated_at = time.time()
            return True
        return False

    def record_iteration(
        self,
        task_id: int,
        score: float,
        evaluator_id: Optional[str] = None,
        pass_threshold: float = 1.0,
    ) -> Dict[str, Any]:
        """Record an evaluation iteration for an optimization loop.

        Enforces:
        1. Role separation (evaluator != generator)
        2. Hard circuit breaker (iteration_count >= max_iterations)
        3. Score plateau detection (delta < plateau_threshold across plateau_cycles)
        """
        task = self.get_task(task_id)
        if not task:
            raise ValueError(f"Task with id {task_id} does not exist")

        # 1. Enforce Role Separation if identities are supplied
        if evaluator_id and task.generator_id and evaluator_id == task.generator_id:
            raise PermissionError(
                f"Evaluator role violation: Agent '{evaluator_id}' cannot evaluate its own output."
            )

        task.evaluator_id = evaluator_id
        task.scores.append(score)
        task.iteration_count += 1
        task.updated_at = time.time()

        # 2. Check for passing threshold
        if score >= pass_threshold:
            task.status = "Completed"
            return {
                "action": "complete",
                "status": task.status,
                "iteration": task.iteration_count,
                "score": score,
                "reason": f"Verification passed with score {score} >= {pass_threshold}",
            }

        # 3. Check Hard Circuit Breaker (iteration cap)
        if task.iteration_count >= self.max_iterations:
            task.status = "CircuitBroken"
            payload = {
                "action": "circuit_break",
                "status": task.status,
                "iteration": task.iteration_count,
                "max_iterations": self.max_iterations,
                "last_score": score,
                "reason": f"Circuit breaker tripped: reached max iterations limit ({self.max_iterations})",
            }
            self._trigger_escalation(task, "circuit_breaker", payload)
            return payload

        # 4. Check Score Plateau Detection
        if len(task.scores) >= self.plateau_cycles:
            recent_scores = task.scores[-self.plateau_cycles :]
            deltas = [
                recent_scores[i] - recent_scores[i - 1]
                for i in range(1, len(recent_scores))
            ]
            # If all recent improvements are strictly below the plateau threshold
            if all(delta < self.plateau_threshold for delta in deltas):
                task.status = "PlateauEscalated"
                payload = {
                    "action": "plateau_escalate",
                    "status": task.status,
                    "iteration": task.iteration_count,
                    "recent_scores": recent_scores,
                    "plateau_threshold": self.plateau_threshold,
                    "reason": (
                        f"Optimization plateau detected: score delta {deltas} "
                        f"below minimum progress threshold {self.plateau_threshold}"
                    ),
                }
                self._trigger_escalation(task, "plateau_detected", payload)
                return payload

        task.status = "In Progress"
        return {
            "action": "continue",
            "status": task.status,
            "iteration": task.iteration_count,
            "score": score,
            "reason": f"Iteration {task.iteration_count}/{self.max_iterations} recorded",
        }

    def _trigger_escalation(
        self, task: Task, reason: str, details: Dict[str, Any]
    ) -> None:
        """Invoke configured escalation handler or fallback."""
        if self.escalation_handler:
            try:
                self.escalation_handler(task, reason, details)
            except Exception:
                pass


def main():
    queue = TaskQueue(max_iterations=3, plateau_threshold=0.05)
    tid = queue.add_task("Test optimization task", generator_id="agent-gen")
    print(f"Created task: {tid}")
    res1 = queue.record_iteration(tid, 0.40, evaluator_id="agent-eval")
    print(f"Cycle 1: {res1['action']} ({queue.get_task_status(tid)})")
    res2 = queue.record_iteration(tid, 0.42, evaluator_id="agent-eval")
    print(f"Cycle 2: {res2['action']} ({queue.get_task_status(tid)})")


if __name__ == "__main__":
    main()
