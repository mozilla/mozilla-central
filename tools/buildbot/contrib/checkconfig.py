from buildbot import master
import sys

class ConfigError(Exception):
  pass

class ConfigLoader(master.BuildMaster):
  def __init__(self, configFileName="master.cfg"):
    master.BuildMaster.__init__(self, ".", configFileName)
    configFile = open(configFileName, "r")
    try:
      self.loadConfig(configFile)
    except:
      raise ConfigError

try:
  if len(sys.argv) > 1:
    c = ConfigLoader(sys.argv[1])
  else:
    c = ConfigLoader()
except IOError:
  sys.exit(2)
except ConfigError:
  sys.exit(1)
