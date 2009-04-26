#!/usr/bin/python

LDAPCSDK_CO_TAG = 'LDAPCSDK_6_0_6_RTM'

CHATZILLA_CO_TAG = 'HEAD'

LDAPCSDK_DIRS = ('directory/c-sdk',)

CHATZILLA_DIRS = ('extensions/irc',)

DEFAULT_COMM_REV = "default"

# URL of the default hg repository to clone for Mozilla.
DEFAULT_MOZILLA_REPO = 'http://hg.mozilla.org/releases/mozilla-1.9.1/'
DEFAULT_MOZILLA_REV = "default"

# REGEX to match against, $1 should refer to protocol scheme
MOZILLA_TRUNK_REPO_REGEXP = "(ssh|http|https):\/\/hg\.mozilla\.org\/mozilla-central\/?$"
MOZILLA_BASE_REV = "GECKO_1_9_1_BASE"

# URL of the default hg repository to clone for inspector.
DEFAULT_INSPECTOR_REPO = 'http://hg.mozilla.org/dom-inspector/'
DEFAULT_INSPECTOR_REV = "default"

# URL of the default hg repository to clone for Venkman.
DEFAULT_VENKMAN_REPO = 'http://hg.mozilla.org/venkman/'
DEFAULT_VENKMAN_REV = "default"

import os
import sys
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

    move_to_stable() is also called.
    """

    move_to_stable()

    import ConfigParser
    config = ConfigParser.ConfigParser()
    config.read([TREE_STATE_FILE])

    # 'src_update_version' values:
    #   '1': "move_to_stable() was successfully run".

    # Do nothing if the current version is up to date.
    if config.has_option('treestate', 'src_update_version') and \
            config.get('treestate', 'src_update_version') == '1':
        return

    if not config.has_section('treestate'):
      config.add_section('treestate')
    config.set('treestate', 'src_update_version', '1')

    # Write this file out
    f = open(TREE_STATE_FILE, 'w')
    try:
      config.write(f)
    finally:
      f.close()

def move_to_stable():
    """Backup (unused anymore) trunk checkout of Mozilla.

    Also switch checkout to MOZILLA_BASE_REV of Mozilla 1.9.1.
    """

    # Do nothing if this function was already successfully run.
    # Shortcut: checking file existence is enough.
    if os.path.exists(TREE_STATE_FILE):
        return

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

    # Compile the Mozilla trunk regex.
    m_c_regex = re.compile(MOZILLA_TRUNK_REPO_REGEXP, re.I)
    match = m_c_regex.match(config.get('paths', 'default'))
    # Do nothing if not pulling from Mozilla trunk.
    if not match:
        return

    config.set('paths', 'default',
               "%s://hg.mozilla.org/releases/mozilla-1.9.1/" % match.group(1) )

    if config.has_option('paths', 'default-push'):
      match = m_c_regex.match(config.get('paths', 'default-push'))
      # Do not update this property if not pushing to Mozilla trunk.
      if match:
        config.set('paths', 'default-push',
                   "%s://hg.mozilla.org/releases/mozilla-1.9.1/" % match.group(1) )

    hgopts = []
    if options.hgopts:
        hgopts = options.hgopts.split()

    mozilla_trunk_path = os.path.join(topsrcdir, '.mozilla-trunk')
    print "Moving mozilla to .mozilla-trunk..."
    try:
        os.rename(mozilla_path, mozilla_trunk_path)
    except:
        # Print the exception without its traceback.
        sys.excepthook(sys.exc_info()[0], sys.exc_info()[1], None)
        sys.exit("Error: Mozilla directory renaming failed!")

    # Locally clone common repository history.
    check_call_noisy([options.hg, 'clone', '-r', MOZILLA_BASE_REV] + hgopts + [mozilla_trunk_path, mozilla_path])

    #Rewrite hgrc for new local mozilla repo based on pre-existing hgrc
    # but with new values
    f = open(os.path.join(topsrcdir, 'mozilla', '.hg', 'hgrc'), 'w')
    try:
      config.write(f)
    finally:
      f.close()

def backup_cvs_venkman():
    """Backup (obsolete) Cvs checkout of Venkman.
    """

    venkmanpath = os.path.join(topsrcdir, 'mozilla', 'extensions', 'venkman')
    # Do nothing if there is no Venkman cvs directory.
    if not os.path.exists(os.path.join(venkmanpath, 'CVS')):
        return

    venkmancvspath = venkmanpath + '-cvs'
    print "Moving venkman to venkman-cvs..."
    try:
        os.rename(venkmanpath, venkmancvspath)
    except:
        # Print the exception without its traceback.
        sys.excepthook(sys.exc_info()[0], sys.exc_info()[1], None)
        sys.exit("Error: Venkman directory renaming failed!")

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
        cmd = [hg, 'pull', '-R', fulldir, '-r', 'tip' ] + hgopts
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
             help="URL of DOM inspector repository to pull from (default: use hg default in mozilla/extensions/inspector/.hg/hgrc; or if that file doesn't exist, use \"" + DEFAULT_INSPECTOR_REPO + "\".)")
o.add_option("--skip-inspector", dest="skip_inspector",
             action="store_true", default=False,
             help="Skip pulling the DOM inspector repository.")
o.add_option("--inspector-rev", dest="inspector_rev",
             default=DEFAULT_INSPECTOR_REV,
             help="Revision of DOM inspector repository to update to. Default: \"" + DEFAULT_INSPECTOR_REV + "\"")

o.add_option("--skip-ldap", dest="skip_ldap",
             action="store_true", default=False,
             help="Skip pulling LDAP from the Mozilla CVS repository.")

o.add_option("--skip-chatzilla", dest="skip_chatzilla",
             action="store_true", default=False,
             help="Skip pulling the ChatZilla repository.")

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

def fixup_inspector_repo_options(options):
    """Handle special case: initial checkout of inspector.

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
    backup_cvs_venkman() is also called.
    """

    backup_cvs_venkman()

    if options.venkman_repo is None and \
            not os.path.exists(os.path.join(topsrcdir, 'mozilla', 'extensions', 'venkman')):
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

    if not options.skip_inspector:
        fixup_inspector_repo_options(options)
        do_hg_pull(os.path.join('mozilla', 'extensions', 'inspector'), options.inspector_repo, options.hg, options.inspector_rev)

    if not options.skip_ldap:
        do_cvs_checkout(LDAPCSDK_DIRS, LDAPCSDK_CO_TAG, options.cvsroot, options.cvs, '')

    if not options.skip_chatzilla:
        do_cvs_checkout(CHATZILLA_DIRS, CHATZILLA_CO_TAG, options.cvsroot, options.cvs, 'mozilla')

    if not options.skip_venkman:
        fixup_venkman_repo_options(options)
        do_hg_pull(os.path.join('mozilla', 'extensions', 'venkman'), options.venkman_repo, options.hg, options.venkman_rev)
else:
    o.print_help()
    sys.exit(2)
