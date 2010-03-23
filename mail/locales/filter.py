def test(mod, path, entity = None):
  import re
  # ignore anyhting but Thunderbird
  if mod not in ("netwerk", "dom", "toolkit", "security/manager",
                 "mail", "editor/ui", "extensions/spellcheck",
                 "other-licenses/branding/thunderbird"):
    return False

  # Ignore Lorentz strings, at least temporarily
  if mod == "toolkit" and path == "chrome/mozapps/plugins/plugins.dtd":
    if entity.startswith('reloadPlugin.'): return False
    if entity.startswith('report.'): return False

  # ignore MOZ_LANGPACK_CONTRIBUTORS
  if mod == "mail" and path == "defines.inc" and \
     entity == "MOZ_LANGPACK_CONTRIBUTORS":
    return False
  # ignore dictionaries
  return not mod == "extensions/spellcheck"
