from copy import copy

from buildbotcustom.env import MozillaEnvironments

MozillaEnvironments['tryserver'] = copy(
    MozillaEnvironments['win32-ref-platform']
)

symbolServerVars = {
    'SYMBOL_SERVER_HOST': 'build.mozilla.org',
    'SYMBOL_SERVER_USER': 'trybld',
    'SYMBOL_SERVER_PATH': '/symbols/windows',
    'SYMBOL_SERVER_SSH_KEY': "$ENV{HOME}/.ssh/id_dsa"
}

MozillaEnvironments['tryserver'].update(symbolServerVars)
