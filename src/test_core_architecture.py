"""Unit tests for PAI Core Architecture: Circuit Breakers, Role Separation & Context Scoping."""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(__file__))

from task_queue import TaskQueue, Task
from agent_manager import AgentManager, Agent


class TestTaskQueueCircuitBreakers(unittest.TestCase):
    def setUp(self):
        self.escalations = []

        def mock_escalation(task, reason, details):
            self.escalations.append((task.id, reason, details))

        self.queue = TaskQueue(
            max_iterations=3,
            plateau_threshold=0.05,
            plateau_cycles=2,
            escalation_handler=mock_escalation,
        )

    def test_add_and_retrieve_task(self):
        tid = self.queue.add_task("Test task", generator_id="gen-1")
        self.assertEqual(tid, 0)
        task = self.queue.get_task(tid)
        self.assertIsNotNone(task)
        self.assertEqual(task.status, "Pending")
        self.assertEqual(task.generator_id, "gen-1")

    def test_pass_threshold_completes_task(self):
        tid = self.queue.add_task("Passing task", generator_id="gen-1")
        res = self.queue.record_iteration(tid, 1.0, evaluator_id="eval-1")
        self.assertEqual(res["action"], "complete")
        self.assertEqual(self.queue.get_task_status(tid), "Completed")
        self.assertEqual(len(self.escalations), 0)

    def test_role_separation_enforced_in_record_iteration(self):
        tid = self.queue.add_task("Self-eval task", generator_id="agent-same")
        with self.assertRaises(PermissionError):
            self.queue.record_iteration(tid, 0.5, evaluator_id="agent-same")

    def test_circuit_breaker_trips_at_max_iterations(self):
        tid = self.queue.add_task("Failing loop task", generator_id="gen-1")
        # Iteration 1: score 0.2
        res1 = self.queue.record_iteration(tid, 0.2, evaluator_id="eval-1")
        self.assertEqual(res1["action"], "continue")
        self.assertEqual(self.queue.get_task_status(tid), "In Progress")

        # Iteration 2: score 0.35 (delta 0.15 > 0.05, so no plateau)
        res2 = self.queue.record_iteration(tid, 0.35, evaluator_id="eval-1")
        self.assertEqual(res2["action"], "continue")

        # Iteration 3: score 0.50 (delta 0.15 > 0.05, but reaches max_iterations = 3)
        res3 = self.queue.record_iteration(tid, 0.50, evaluator_id="eval-1")
        self.assertEqual(res3["action"], "circuit_break")
        self.assertEqual(self.queue.get_task_status(tid), "CircuitBroken")
        self.assertEqual(len(self.escalations), 1)
        self.assertEqual(self.escalations[0][1], "circuit_breaker")

    def test_plateau_detection_escalates_before_max_iterations(self):
        # Set max_iterations high to ensure plateau trips first
        queue = TaskQueue(
            max_iterations=10,
            plateau_threshold=0.05,
            plateau_cycles=2,
            escalation_handler=lambda t, r, d: self.escalations.append((t.id, r, d)),
        )
        tid = queue.add_task("Plateau task", generator_id="gen-1")

        # Cycle 1: 0.60
        queue.record_iteration(tid, 0.60, evaluator_id="eval-1")
        # Cycle 2: 0.62 (delta = 0.02 < 0.05 plateau threshold)
        res = queue.record_iteration(tid, 0.62, evaluator_id="eval-1")

        self.assertEqual(res["action"], "plateau_escalate")
        self.assertEqual(queue.get_task_status(tid), "PlateauEscalated")
        self.assertEqual(len(self.escalations), 1)
        self.assertEqual(self.escalations[0][1], "plateau_detected")


class TestAgentManagerRoleSeparationAndContextScoping(unittest.TestCase):
    def setUp(self):
        self.manager = AgentManager()

    def test_register_and_list_agents(self):
        a1 = self.manager.register_agent("gen-alpha", role="generator")
        a2 = self.manager.register_agent("eval-beta", role="evaluator")
        self.assertEqual(a1.role, "generator")
        self.assertIn("src", a1.allowed_domains)
        self.assertIn("audit", a2.allowed_domains)
        self.assertEqual(len(self.manager.list_agents()), 2)

    def test_validate_evaluator_pairing(self):
        self.manager.register_agent("gen-1", role="generator")
        self.manager.register_agent("eval-1", role="evaluator")

        # Valid pairing
        self.assertTrue(self.manager.validate_evaluator_pairing("gen-1", "eval-1"))

        # Same agent raises PermissionError
        with self.assertRaises(PermissionError):
            self.manager.validate_evaluator_pairing("gen-1", "gen-1")

        # Inverted roles raise ValueError
        with self.assertRaises(ValueError):
            self.manager.validate_evaluator_pairing("eval-1", "gen-1")

    def test_context_scoping_strips_unauthorized_keys(self):
        scraper = self.manager.register_agent("scraper-1", role="web_scraper")
        # Allowed for web_scraper: ['public_web', 'docs']
        raw_payload = {
            "public_web": {"url": "https://example.com", "html": "<h1>Docs</h1>"},
            "docs": {"title": "Architecture Guide"},
            "credentials": {"api_key": "SK_SUPER_SECRET_123"},
            "financial": {"balance": 1000000},
            "src": {"path": "src/sensitive.py"},
        }

        res = self.manager.set_agent_state("scraper-1", raw_payload)
        scoped = res["scoped_state"]

        self.assertIn("public_web", scoped)
        self.assertIn("docs", scoped)
        self.assertNotIn("credentials", scoped)
        self.assertNotIn("financial", scoped)
        self.assertNotIn("src", scoped)
        self.assertIn("credentials", res["stripped_keys"])
        self.assertIn("financial", res["stripped_keys"])

    def test_export_scoped_context_to_ledger(self):
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tf:
            temp_path = tf.name

        try:
            agent = self.manager.register_agent("audit-agent", role="evaluator")
            self.manager.set_agent_state(
                "audit-agent",
                {
                    "test": {"cases_passed": 26},
                    "verify": {"clean": True},
                    "credentials": {"leak": "not_allowed"},
                },
            )
            exported = self.manager.export_scoped_context("audit-agent", temp_path)
            self.assertEqual(exported["agent_id"], "audit-agent")
            self.assertIn("test", exported["state"])
            self.assertNotIn("credentials", exported["state"])

            # Verify on-disk ledger
            import json
            with open(temp_path, "r", encoding="utf-8") as f:
                on_disk = json.load(f)
            self.assertIn("agent_audit-agent", on_disk)
            self.assertIn("test", on_disk["agent_audit-agent"]["state"])
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)


if __name__ == "__main__":
    unittest.main()
