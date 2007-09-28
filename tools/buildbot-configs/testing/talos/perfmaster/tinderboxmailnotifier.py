from buildbot.status import tinderbox

class TinderboxMailNotifier(tinderbox.TinderboxMailNotifier):
  """
  Subclass TinderboxMailNotifier to add the slave name to the build.
  This makes tinderbox happy if we have more than one slave working
  on one builder.
  """
  def buildMessage(self, name, build, results):
    return tinderbox.TinderboxMailNotifier.buildMessage(self,
                                                        name + ' ' +
                                                        build.getSlavename(),
                                                        build, results)
