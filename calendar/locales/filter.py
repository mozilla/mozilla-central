
def test(mod, path, entity = None):
  import re

  # ignore anyhting but calendar stuff
  if mod not in ("netwerk", "dom", "toolkit", "security/manager",
                 "calendar", "other-licenses/branding/sunbird"):
    return False

  # Timezone properties don't have to be translated
  if path == "chrome/calendar/timezones.properties":
    return False

  # Noun class entries do not have to be translated
  if path == "chrome/calendar/calendar-event-dialog.properties":
    return not re.match(r".*Nounclass[1-9]", entity)

  # Everything else should be taken into account
  return True
