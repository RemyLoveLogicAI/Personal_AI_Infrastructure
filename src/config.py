CONFIG_PATH = 'config.json'

DEFAULT_MAX_ITERATIONS = 3
DEFAULT_PLATEAU_THRESHOLD = 0.05
DEFAULT_PLATEAU_CYCLES = 2
DEFAULT_TASK_TIMEOUT = 300

DEFAULT_SCOPED_PERMISSIONS = {
    "generator": ["src", "components", "local"],
    "evaluator": ["test", "verify", "audit"],
    "web_scraper": ["public_web", "docs"],
    "security": ["security", "gates", "policies"]
}

DEFAULT_CONFIG = {
    "agents": {},
    "circuit_breaker": {
        "max_iterations": DEFAULT_MAX_ITERATIONS,
        "plateau_threshold": DEFAULT_PLATEAU_THRESHOLD,
        "plateau_cycles": DEFAULT_PLATEAU_CYCLES
    },
    "scoped_permissions": DEFAULT_SCOPED_PERMISSIONS
}