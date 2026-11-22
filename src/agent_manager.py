"""Agent Manager Implementation with Role Separation & Context Scoping.

Enforces least-privilege context boundaries and evaluator role separation
for multi-agent coordination in the Personal AI Infrastructure.
"""

from dataclasses import dataclass, field
import json
import os
from typing import Any, Dict, List, Optional, Set

try:
    from .config import DEFAULT_SCOPED_PERMISSIONS
except ImportError:
    from config import DEFAULT_SCOPED_PERMISSIONS


@dataclass
class Agent:
    id: str
    role: str
    allowed_domains: Set[str] = field(default_factory=set)
    state: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


class AgentManager:
    def __init__(
        self,
        scoped_permissions: Optional[Dict[str, List[str]]] = None,
        ledger_path: Optional[str] = None,
    ):
        self.agents: Dict[str, Agent] = {}
        self.scoped_permissions = scoped_permissions or DEFAULT_SCOPED_PERMISSIONS
        self.ledger_path = ledger_path or os.path.expanduser("~/.agentsroom/universal_ledger.json")

    def register_agent(
        self,
        agent_id: str,
        role: str = "generator",
        allowed_domains: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Agent:
        """Register an agent with assigned role and scoped context domain permissions."""
        if allowed_domains is None:
            # Default to predefined domain bounds for this role
            domains = set(self.scoped_permissions.get(role, ["local"]))
        else:
            domains = set(allowed_domains)

        agent = Agent(
            id=agent_id,
            role=role,
            allowed_domains=domains,
            metadata=metadata or {},
        )
        self.agents[agent_id] = agent
        return agent

    def get_agent(self, agent_id: str) -> Optional[Agent]:
        """Retrieve agent by id."""
        return self.agents.get(agent_id)

    def list_agents(self) -> List[Agent]:
        """List all registered agents."""
        return list(self.agents.values())

    def validate_evaluator_pairing(self, generator_id: str, evaluator_id: str) -> bool:
        """Enforce strict evaluator role separation.

        A generator agent cannot evaluate its own output, and the evaluator
        must have an evaluation/audit capability.
        """
        if generator_id == evaluator_id:
            raise PermissionError(
                f"Role Separation Violation: Agent '{generator_id}' cannot evaluate its own output."
            )

        gen_agent = self.get_agent(generator_id)
        eval_agent = self.get_agent(evaluator_id)

        if gen_agent and gen_agent.role == "evaluator":
            raise ValueError(f"Agent '{generator_id}' has role 'evaluator' and cannot act as generator.")

        if eval_agent and eval_agent.role == "generator":
            raise ValueError(f"Agent '{evaluator_id}' has role 'generator' and cannot act as independent evaluator.")

        return True

    def set_agent_state(
        self, agent_id: str, raw_payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Assign state to an agent, strictly scoping keys by allowed domain boundaries.

        Any keys in raw_payload not matching agent's allowed_domains (or sensitive keys
        like credentials, tokens, financial data when not explicitly allowed) are stripped.
        """
        agent = self.get_agent(agent_id)
        if not agent:
            raise ValueError(f"Agent '{agent_id}' does not exist")

        scoped_state: Dict[str, Any] = {}
        stripped_keys: List[str] = []

        # Sensitive domains that require explicit permission
        sensitive_domains = {"credentials", "tokens", "secrets", "financial", "identity_raw"}

        for key, value in raw_payload.items():
            # Domain check: either exact key or domain category
            if key in agent.allowed_domains or "*" in agent.allowed_domains:
                # Extra check: prevent sensitive domain leakage unless specifically in allowed_domains
                if key in sensitive_domains and key not in agent.allowed_domains:
                    stripped_keys.append(key)
                else:
                    scoped_state[key] = value
            else:
                stripped_keys.append(key)

        agent.state = scoped_state
        return {
            "agent_id": agent_id,
            "retained_keys": list(scoped_state.keys()),
            "stripped_keys": stripped_keys,
            "scoped_state": scoped_state,
        }

    def export_scoped_context(
        self, agent_id: str, custom_ledger_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Export sanitized agent context to the Universal Context Ledger format."""
        agent = self.get_agent(agent_id)
        if not agent:
            raise ValueError(f"Agent '{agent_id}' does not exist")

        context_obj = {
            "agent_id": agent.id,
            "role": agent.role,
            "allowed_domains": sorted(list(agent.allowed_domains)),
            "state": agent.state,
        }

        path = custom_ledger_path or self.ledger_path
        if path:
            try:
                os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
                ledger_data: Dict[str, Any] = {}
                if os.path.exists(path):
                    with open(path, "r", encoding="utf-8") as f:
                        try:
                            ledger_data = json.load(f)
                        except json.JSONDecodeError:
                            ledger_data = {}
                ledger_data[f"agent_{agent.id}"] = context_obj
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(ledger_data, f, indent=2)
            except Exception:
                pass

        return context_obj
