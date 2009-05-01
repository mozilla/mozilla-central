def test(mod, path, entity = None):
  import re
  # ignore anything but SeaMonkey
  if mod not in ("netwerk", "dom", "toolkit", "security/manager",
                 "extensions/reporter", "editor/ui",
                 "suite"):
    return False
  # ignore temporary files, hiden files and files from rejects
  if (re.match(r".*?\/[.#].+", path) or
      re.match(r".*~$", path) or
      re.match(r".+\.(orig|rej)", path)):
    return False
  if mod not in ("suite"):
    # we only have exceptions for suite
    return True
  if entity is None:
    # missing and obsolete files
    return not (re.match(r"searchplugins\/.+\.src", path) or
                re.match(r"searchplugins\/.+\.png", path) or
                re.match(r"chrome\/common\/help\/images\/[A-Za-z-_]+\.[a-z]+", path))
  if path == "defines.inc":
    return entity != "MOZ_LANGPACK_CONTRIBUTORS"
  if path == "profile/more-bookmarks.inc" or path == "profile/panels.inc":
    # ignore files for additional bookmarks and panels
    return False
  
  return True
