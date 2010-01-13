#!/usr/bin/env python

# LDAP
LDAPCSDK_CO_TAG = 'LDAPCSDK_6_0_6D_MOZILLA_RTM'
LDAPCSDK_DIRS = ('directory/c-sdk',)

# URL of the default hg repository to clone for ChatZilla.
DEFAULT_CHATZILLA_REPO = 'http://hg.mozilla.org/chatzilla/'
DEFAULT_CHATZILLA_REV = "default"

# URL of the default hg repository to clone for DOM Inspector.
DEFAULT_INSPECTOR_REPO = 'http://hg.mozilla.org/dom-inspector/'
DEFAULT_INSPECTOR_REV = "default"

# URL of the default hg repository to clone for Venkman.
DEFAULT_VENKMAN_REPO = 'http://hg.mozilla.org/venkman/'
DEFAULT_VENKMAN_REV = "default"

DEFAULT_COMM_REV = "default"

# URL of the default hg repository to clone for Mozilla.
DEFAULT_MOZILLA_REPO = 'http://hg.mozilla.org/mozilla-central/'
DEFAULT_MOZILLA_REV = "default"

# The set of defaults below relate to the current switching mechanism between
# trunk or branches and back again if it is required.

# The current version expected in the .treestate file for nothing to happen.
# This reflects the "[treestate] src_update_version = ..." value.
#
# src_update_version values:
# '1' : mozilla/ may have been moved to mozilla-1.9.1 (or kept the same
#       depending on set-up).
# '2' : mozilla/ may have been moved back to mozilla-central.
CURRENT_TREESTATE_VERSION = '2'
# REGEX to match against, $1 should refer to protocol scheme
SWITCH_MOZILLA_REPO_REGEXP = '(ssh|http|https):\/\/hg\.mozilla\.org\/releases/mozilla-1.9.1\/?$'
# The location to back-up the existing mozilla repo to, e.g. ".mozilla-trunk"
# or ".mozilla-1.9.1".
SWITCH_MOZILLA_REPO_BACKUP_LOCATION = ".mozilla-1.9.1"
# This is the potential location for a repository from the last time we
# switched. Can be blank for no effect.
SWITCH_MOZILLA_REPO_OLD_REPO_LOCATION = ".mozilla-trunk"
# This should be the same as DEFAULT_MOZILLA_REPO but using %s instead of http
# for the scheme.
SWITCH_MOZILLA_REPO_REPLACE = '%s://hg.mozilla.org/mozilla-central/'
SWITCH_MOZILLA_BASE_REV = "GECKO_1_9_1_BASE"

import sys
# Test Python Version. 2.4 required for `import subprocess`
pyver = sys.version_info
if pyver[0] == 2 and pyver[1] < 4:
  sys.exit("ERROR: Python 2.4 or newer required")
elif pyver[0] == 3:
  sys.exit("ERROR: Python series 3 is not supported, use series 2 > 2.4")
del pyver

import os
import datetime
from optparse import OptionParser

topsrcdir = os.path.dirname(__file__)
if topsrcdir == '':
    topsrcdir = '.'

TREE_STATE_FILE = os.path.join(topsrcdir, '.treestate')

try:
    from subprocess import check_call
except ImportError:
    import subprocess
    def check_call(*popenargs, **kwargs):
        retcode = subprocess.call(*popenargs, **kwargs)
        if retcode:
            cmd = kwargs.get("args")
            if cmd is None:
                cmd = popenargs[0]
                raise Exception("Command '%s' returned non-zero exit status %i" % (cmd, retcode))

def check_call_noisy(cmd, *args, **kwargs):
    print "Executing command:", cmd
    check_call(cmd, *args, **kwargs)

def repo_config():
    """Create/Update TREE_STATE_FILE as needed.

    switch_mozilla_repo() may be called if the branch that the mozilla repo is
    on needs changing
    """

    import ConfigParser

    config_version = CURRENT_TREESTATE_VERSION

    config = ConfigParser.ConfigParser()

    # If the file exists, see if we need to move to the stable branch.
    # If it doesn't exist, we assume the user hasn't pulled before (or has
    # done it manually) and therefore leave his mozilla/ repo as it is.
    if os.path.exists(TREE_STATE_FILE):
        config.read([TREE_STATE_FILE])

        if config.has_option('treestate', 'src_update_version'):
            config_version = config.get('treestate', 'src_update_version')
        else:
            # If src_update_version doesn't exist, assume this to be '1' and
            # apply the update. This was because the first version of this
            # migration allowed the existence of the file to equate to '1'.
            config_version = '1'

    # Do nothing if the current version is up to date.
    if config_version < CURRENT_TREESTATE_VERSION:
        switch_mozilla_repo()

    if not os.path.exists(TREE_STATE_FILE) or config_version < CURRENT_TREESTATE_VERSION:
        if not config.has_section('treestate'):
            config.add_section('treestate')
        config.set('treestate', 'src_update_version', CURRENT_TREESTATE_VERSION)

        # Write this file out
        f = open(TREE_STATE_FILE, 'w')
        try:
            config.write(f)
        finally:
            f.close()

def switch_mozilla_repo():
    """If the mozilla/ repo matches SWITCH_MOZILLA_REPO_REGEXP then:
    1) Backup (unused anymore) checkout of mozilla/.
    2a) If SWITCH_MOZILLA_REPO_OLD_REPO_LOCATION exists, move that to mozilla/.
    2b) Else clone the backup of mozilla/ up to the SWITCH_MOZILLA_BASE_REV
        revision and set the pull location to SWITCH_MOZILLA_REPO_REPLACE.

    It is expected that the normal pull/update functions in this script will
    update the new mozilla/ repo to the latest version.
    """

    mozilla_path = os.path.join(topsrcdir, 'mozilla')
    # Do nothing if there is no Mozilla directory.
    if not os.path.exists(mozilla_path):
      return

    import ConfigParser, re
    config = ConfigParser.ConfigParser()
    config.read([os.path.join(mozilla_path, '.hg', 'hgrc')])
    if not config.has_option('paths', 'default'):
        # Abort, not to get into a possibly inconsistent state.
        sys.exit("Error: default path in mozilla/.hg/hgrc is undefined!")

    # Compile the Mozilla repository regex.
    moz_old_regex = re.compile(SWITCH_MOZILLA_REPO_REGEXP, re.I)
    match = moz_old_regex.match(config.get('paths', 'default'))
    # Do nothing if not pulling from the one we're trying to switch from.
    if not match:
        return

    config.set('paths', 'default',
               SWITCH_MOZILLA_REPO_REPLACE % match.group(1) )

    if config.has_option('paths', 'default-push'):
      match = moz_old_regex.match(config.get('paths', 'default-push'))
      # Do not update this property if not pushing to Mozilla trunk.
      if match:
        config.set('paths', 'default-push',
                   SWITCH_MOZILLA_REPO_REPLACE % match.group(1) )

    hgopts = []
    if options.hgopts:
        hgopts = options.hgopts.split()

    backup_mozilla_path = os.path.join(topsrcdir, SWITCH_MOZILLA_REPO_BACKUP_LOCATION)
    print "Moving mozilla to " + SWITCH_MOZILLA_REPO_BACKUP_LOCATION + "..."
    try:
        os.rename(mozilla_path, backup_mozilla_path)
    except:
        # Print the exception without its traceback.
        sys.excepthook(sys.exc_info()[0], sys.exc_info()[1], None)
        sys.exit("Error: Mozilla directory renaming failed!")

    # Does the user have a pre-existing backup repository?
    old_backup_repository = os.path.join(topsrcdir, SWITCH_MOZILLA_REPO_OLD_REPO_LOCATION)
    if SWITCH_MOZILLA_REPO_OLD_REPO_LOCATION != "" and \
            os.path.exists(old_backup_repository):
        # Yes, so let's use that
        print "Moving " + old_backup_repository + " to " + mozilla_path + "..."
        try:
            os.rename(old_backup_repository, mozilla_path)
        except:
            # Print the exception without its traceback.
            sys.excepthook(sys.exc_info()[0], sys.exc_info()[1], None)
            sys.exit("Error: Renaming old backup directory failed! You must recover manually.")
        # Let's leave the hgrc as it was, so any repo specific config is left
        # the same.
        return

    # Locally clone common repository history.
    check_call_noisy([options.hg, 'clone', '-r', SWITCH_MOZILLA_BASE_REV] + hgopts + [backup_mozilla_path, mozilla_path])

    # Rewrite hgrc for new local mozilla repo based on pre-existing hgrc
    # but with new values
    f = open(os.path.join(topsrcdir, 'mozilla', '.hg', 'hgrc'), 'w')
    try:
      config.write(f)
    finally:
      f.close()

def backup_cvs_extension(extensionName, extensionDir, extensionPath):
    """Backup (obsolete) cvs checkout of extensionName.
    """

    # Do nothing if there is no extensionName cvs directory.
    if not os.path.exists(os.path.join(extensionPath, 'CVS')):
        return

    extensionBackupPath = extensionPath + '-cvs'
    print "Moving %s to %s-cvs..." % (extensionDir, extensionDir)
    try:
        os.rename(extensionPath, extensionBackupPath)
    except:
        # Print the exception without its traceback.
        sys.excepthook(sys.exc_info()[0], sys.exc_info()[1], None)
        sys.exit("Error: %s directory renaming failed!" % extensionName)

def do_hg_pull(dir, repository, hg, rev):
    fulldir = os.path.join(topsrcdir, dir)
    # clone if the dir doesn't exist, pull if it does
    hgopts = []
    if options.hgopts:
        hgopts = options.hgopts.split()
    if not os.path.exists(fulldir):
        fulldir = os.path.join(topsrcdir, dir)
        check_call_noisy([hg, 'clone'] + hgopts + [repository, fulldir])
    else:
        cmd = [hg, 'pull', '-R', fulldir] + hgopts
        if repository is not None:
            cmd.append(repository)
        check_call_noisy(cmd)
    # update to specific revision
    if options.verbose:
        cmd = [hg, 'update', '-v', '-r', rev, '-R', fulldir ] + hgopts
    else:
        cmd = [hg, 'update', '-r', rev, '-R', fulldir ] + hgopts
    check_call_noisy(cmd)
    check_call([hg, 'parent', '-R', fulldir,
                '--template=Updated to revision {node}.\n'])

def do_cvs_checkout(modules, tag, cvsroot, cvs, checkoutdir):
    """Check out a CVS directory into the checkoutdir subdirectory.
    modules is a list of directories to check out, e.g. ['extensions/irc']
    """
    for module in modules:
        (parent, leaf) = os.path.split(module)
        print "CVS checkout begin: " + datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        if tag == 'HEAD':
            check_call_noisy([cvs, '-d', cvsroot, '-q',
                              'checkout', '-P', '-A', '-d', leaf,
                              'mozilla/%s' % module],
                             cwd=os.path.join(topsrcdir, checkoutdir, parent))
        else:
            check_call_noisy([cvs, '-d', cvsroot, '-q',
                              'checkout', '-P', '-r', tag, '-d', leaf,
                              'mozilla/%s' % module],
                             cwd=os.path.join(topsrcdir, checkoutdir, parent))
        print "CVS checkout end: " + datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

o = OptionParser(usage="client.py [options] checkout")
o.add_option("-m", "--comm-repo", dest="comm_repo",
             default=None,
             help="URL of comm (Calendar/Mail/Suite) repository to pull from (default: use hg default in .hg/hgrc)")
o.add_option("--skip-comm", dest="skip_comm",
             action="store_true", default=False,
             help="Skip pulling the comm (Calendar/Mail/Suite) repository.")
o.add_option("--comm-rev", dest="comm_rev",
             default=DEFAULT_COMM_REV,
             help="Revision of comm (Calendar/Mail/Suite) repository to update to. Default: \"" + DEFAULT_COMM_REV + "\"")

o.add_option("-z", "--mozilla-repo", dest="mozilla_repo",
             default=None,
             help="URL of Mozilla repository to pull from (default: use hg default in mozilla/.hg/hgrc; or if that file doesn't exist, use \"" + DEFAULT_MOZILLA_REPO + "\".)")
o.add_option("--skip-mozilla", dest="skip_mozilla",
             action="store_true", default=False,
             help="Skip pulling the Mozilla repository.")
o.add_option("--mozilla-rev", dest="mozilla_rev",
             default=DEFAULT_MOZILLA_REV,
             help="Revision of Mozilla repository to update to. Default: \"" + DEFAULT_MOZILLA_REV + "\"")

o.add_option("--inspector-repo", dest="inspector_repo",
             default=None,
             help="URL of DOM Inspector repository to pull from (default: use hg default in mozilla/extensions/inspector/.hg/hgrc; or if that file doesn't exist, use \"" + DEFAULT_INSPECTOR_REPO + "\".)")
o.add_option("--skip-inspector", dest="skip_inspector",
             action="store_true", default=False,
             help="Skip pulling the DOM Inspector repository.")
o.add_option("--inspector-rev", dest="inspector_rev",
             default=DEFAULT_INSPECTOR_REV,
             help="Revision of DOM Inspector repository to update to. Default: \"" + DEFAULT_INSPECTOR_REV + "\"")

o.add_option("--skip-ldap", dest="skip_ldap",
             action="store_true", default=False,
             help="Skip pulling LDAP from the Mozilla CVS repository.")

o.add_option("--chatzilla-repo", dest = "chatzilla_repo",
             default = None,
             help = "URL of ChatZilla repository to pull from (default: use hg default in mozilla/extensions/irc/.hg/hgrc; or if that file doesn't exist, use \"" + DEFAULT_CHATZILLA_REPO + "\".)")
o.add_option("--skip-chatzilla", dest="skip_chatzilla",
             action="store_true", default=False,
             help="Skip pulling the ChatZilla repository.")
o.add_option("--chatzilla-rev", dest = "chatzilla_rev",
             default = DEFAULT_CHATZILLA_REV,
             help = "Revision of ChatZilla repository to update to. Default: \"" + DEFAULT_CHATZILLA_REV + "\"")


o.add_option("--venkman-repo", dest = "venkman_repo",
             default = None,
             help = "URL of Venkman repository to pull from (default: use hg default in mozilla/extensions/venkman/.hg/hgrc; or if that file doesn't exist, use \"" + DEFAULT_VENKMAN_REPO + "\".)")
o.add_option("--skip-venkman", dest="skip_venkman",
             action="store_true", default=False,
             help="Skip pulling the Venkman repository.")
o.add_option("--venkman-rev", dest = "venkman_rev",
             default = DEFAULT_VENKMAN_REV,
             help = "Revision of Venkman repository to update to. Default: \"" + DEFAULT_VENKMAN_REV + "\"")

o.add_option("--hg", dest="hg", default=os.environ.get('HG', 'hg'),
             help="The location of the hg binary")
o.add_option("--cvs", dest="cvs", default=os.environ.get('CVS', 'cvs'),
             help="The location of the cvs binary")
o.add_option("--cvsroot", dest="cvsroot",
             default=os.environ.get('CVSROOT', ':pserver:anonymous@cvs-mirror.mozilla.org:/cvsroot'),
             help="The CVSROOT (default: :pserver:anonymous@cvs-mirror.mozilla.org:/cvsroot")
o.add_option("-v", "--verbose", dest="verbose",
             action="store_true", default=False,
             help="Enable verbose output on hg updates")
o.add_option("--hg-options", dest="hgopts",
             help="Pass arbitrary options to hg commands (i.e. --debug, --time)")

def fixup_comm_repo_options(options):
    """Check options.comm_repo value.

    options.comm_repo is normally None.
    This is fine -- our "hg pull" command will omit the repo URL.
    The exception is the initial checkout, which does an "hg clone".
    That command requires a repository URL.
    """

    if options.comm_repo is None and \
            not os.path.exists(os.path.join(topsrcdir, '.hg')):
        o.print_help()
        print
        print "Error: the -m option is required for the initial checkout!"
        sys.exit(2)

def fixup_mozilla_repo_options(options):
    """Handle special case: initial checkout of Mozilla.

    See fixup_comm_repo_options().
    """
    if options.mozilla_repo is None and \
            not os.path.exists(os.path.join(topsrcdir, 'mozilla')):
        options.mozilla_repo = DEFAULT_MOZILLA_REPO

def fixup_chatzilla_repo_options(options):
    """Handle special case: initial hg checkout of Chatzilla.

    See fixup_comm_repo_options().
    backup_cvs_extension() is also called.
    """

    extensionPath = os.path.join(topsrcdir, 'mozilla', 'extensions', 'irc')

    backup_cvs_extension('Chatzilla', 'irc', extensionPath)

    if options.chatzilla_repo is None and not os.path.exists(extensionPath):
        options.chatzilla_repo = DEFAULT_CHATZILLA_REPO

def fixup_inspector_repo_options(options):
    """Handle special case: initial checkout of DOM Inspector.

    See fixup_comm_repo_options().
    """

    # No cvs backup needed as DOM Inspector was part (and removed from)
    # Mozilla hg repository.
    if options.inspector_repo is None and \
            not os.path.exists(os.path.join(topsrcdir, 'mozilla', 'extensions', 'inspector')):
        options.inspector_repo = DEFAULT_INSPECTOR_REPO

def fixup_venkman_repo_options(options):
    """Handle special case: initial hg checkout of Venkman.

    See fixup_comm_repo_options().
    backup_cvs_extension() is also called.
    """

    extensionPath = os.path.join(topsrcdir, 'mozilla', 'extensions', 'venkman')

    backup_cvs_extension('Venkman', 'venkman', extensionPath)

    if options.venkman_repo is None and not os.path.exists(extensionPath):
        options.venkman_repo = DEFAULT_VENKMAN_REPO

try:
    (options, (action,)) = o.parse_args()
except ValueError:
    o.print_help()
    sys.exit(2)

if action in ('checkout', 'co'):
    # Update Comm repository configuration.
    repo_config()

    if not options.skip_comm:
        fixup_comm_repo_options(options)
        do_hg_pull('.', options.comm_repo, options.hg, options.comm_rev)

    if not options.skip_mozilla:
        fixup_mozilla_repo_options(options)
        do_hg_pull('mozilla', options.mozilla_repo, options.hg, options.mozilla_rev)

    # Check whether destination directory exists for these extensions.
    if (not options.skip_chatzilla or not options.skip_inspector or \
                not options.skip_venkman) and \
            not os.path.exists(os.path.join(topsrcdir, 'mozilla', 'extensions')):
        # Don't create the directory: Mozilla repository should provide it...
        sys.exit("Error: mozilla/extensions directory does not exist;" + \
                 " ChatZilla, DOM Inspector and/or Venkman cannot be checked out!")

    if not options.skip_chatzilla:
        fixup_chatzilla_repo_options(options)
        do_hg_pull(os.path.join('mozilla', 'extensions', 'irc'), options.chatzilla_repo, options.hg, options.chatzilla_rev)

    if not options.skip_inspector:
        fixup_inspector_repo_options(options)
        do_hg_pull(os.path.join('mozilla', 'extensions', 'inspector'), options.inspector_repo, options.hg, options.inspector_rev)

    if not options.skip_ldap:
        do_cvs_checkout(LDAPCSDK_DIRS, LDAPCSDK_CO_TAG, options.cvsroot, options.cvs, '')

    if not options.skip_venkman:
        fixup_venkman_repo_options(options)
        do_hg_pull(os.path.join('mozilla', 'extensions', 'venkman'), options.venkman_repo, options.hg, options.venkman_rev)
else:
    o.print_help()
    sys.exit(2)
