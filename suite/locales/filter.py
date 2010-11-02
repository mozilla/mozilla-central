def test(mod, path, entity = None):
  import re
  # ignore anything but SeaMonkey
  if mod not in ("netwerk", "dom", "toolkit", "security/manager",
                 "editor/ui", "suite"):
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
    return not (re.match(r"searchplugins\/.+\.xml", path) or
                re.match(r"chrome\/common\/help\/images\/[A-Za-z-_]+\.[a-z]+", path))
  if path == "defines.inc":
    return entity != "MOZ_LANGPACK_CONTRIBUTORS"
  if path == "profile/bookmarks.extra" or path == "profile/panels.extra":
    # ignore files for additional bookmarks and panels
    return False
    
  if path == "chrome/common/region.properties":
    return not re.match(r"browser\.search\.order\.[1-9]", entity)

  if path != "chrome/browser/region.properties":
    # only region.properties exceptions remain, compare all others
    return True

  return not re.match(r"browser\.contentHandlers\.types\.[0-5]", entity)
