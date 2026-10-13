def load_config(config_path):
    import json
    with open(config_path, 'r') as file:
        return json.load(file)


def save_config(config_path, config):
    import json
    with open(config_path, 'w') as file:
        json.dump(config, file)