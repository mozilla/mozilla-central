
def test(mod, path, entity = None):
  import re

  # ignore anyhting but calendar stuff
  if mod not in ("netwerk", "dom", "toolkit", "security/manager",
                 "calendar", "other-licenses/branding/sunbird"):
    return False

  # Timezone properties don't have to be translated
  if path == "chrome/calendar/timezones.properties":
    return "report"

  # Noun class entries do not have to be translated
  if path == "chrome/calendar/calendar-event-dialog.properties":
    return not re.match(r".*Nounclass[1-9]", entity)

  # most extraction related strings are not required
  if path == "chrome/calendar/calendar-extract.properties":
    if not re.match(r"from.today", entity):
      return "report"

  # Sunbird specific strings don't need translation
  if path.startswith("chrome/sunbird/"):
    return False

  # Everything else should be taken into account
  return True
