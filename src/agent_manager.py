class AgentManager:
    def __init__(self):
        self.agents = {}

    def add_agent(self, agent_id, agent):
        self.agents[agent_id] = agent

    def remove_agent(self, agent_id):
        if agent_id in self.agents:
            del self.agents[agent_id]

    def get_agent(self, agent_id):
        return self.agents.get(agent_id)

    def get_state(self, agent_id):
        agent = self.get_agent(agent_id)
        if agent:
            return agent.get_state()
        return None

    def set_state(self, agent_id, state):
        agent = self.get_agent(agent_id)
        if agent:
            agent.set_state(state)
        else:
            raise ValueError(f"Agent {agent_id} not found")

    def clear_state(self, agent_id):
        agent = self.get_agent(agent_id)
        if agent:
            agent.clear_state()
        else:
            raise ValueError(f"Agent {agent_id} not found")