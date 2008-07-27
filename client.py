#!/usr/bin/python

CALENDAR_CO_TAG = 'HEAD'
EXTENSION_CO_TAG = 'HEAD'
LDAPCSDK_CO_TAG = 'LDAPCSDK_6_0_3_CLIENT_BRANCH'

CHATZILLA_CO_TAG = 'HEAD'
VENKMAN_CO_TAG = 'HEAD'

CALENDAR_DIRS = ('calendar',)
EXTENSION_DIRS = ('extensions/typeaheadfind',
                  'extensions/wallet',)
LDAPCSDK_DIRS = ('directory/c-sdk',)

CHATZILLA_DIRS = ('extensions/irc',)
VENKMAN_DIRS = ('extensions/venkman',)

# URL of the default hg repository to clone for Mozilla.
DEFAULT_MOZILLA_REPO = 'http://hg.mozilla.org/mozilla-central/'

import os
import sys
import datetime
from optparse import OptionParser

topsrcdir = os.path.dirname(__file__)
if topsrcdir == '':
    topsrcdir = '.'

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

def do_hg_pull(dir, repository, hg):
    fulldir = os.path.join(topsrcdir, dir)
    # clone if the dir doesn't exist, pull if it does
    if not os.path.exists(fulldir):
        fulldir = os.path.join(topsrcdir, dir)
        check_call_noisy([hg, 'clone', repository, fulldir])
    else:
        if options.verbose:
            cmd = [hg, 'pull', '-u', '-v', '-R', fulldir]
        else:
            cmd = [hg, 'pull', '-u', '-R', fulldir]
        if repository is not None:
            cmd.append(repository)
        check_call_noisy(cmd)
    check_call([hg, 'parent', '-R', fulldir,
                '--template=Updated to revision {node}.\n'])

def do_cvs_checkout(modules, tag, cvsroot, cvs, checkoutdir):
    """Check out a CVS directory into the mozilla/ subdirectory.
    modules is a list of directories to check out, e.g. ['extensions/irc']
    """
    for module in modules:
        (parent, leaf) = os.path.split(module)
        print "CVS checkout begin: " + datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
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

o.add_option("-z", "--mozilla-repo", dest="mozilla_repo",
             default=None,
             help="URL of Mozilla repository to pull from (default: use hg default in mozilla/.hg/hgrc; or if that file doesn't exist, use \"" + DEFAULT_MOZILLA_REPO + "\".)")
o.add_option("--skip-mozilla", dest="skip_mozilla",
             action="store_true", default=False,
             help="Skip pulling the Mozilla repository.")

o.add_option("--skip-cvs", dest="skip_cvs",
             action="store_true", default=False,
             help="Skip pulling the old directories from the Mozilla CVS repository.")
o.add_option("--skip-chatzilla", dest="skip_chatzilla",
             action="store_true", default=False,
             help="Skip pulling the ChatZilla repository.")
o.add_option("--skip-venkman", dest="skip_venkman",
             action="store_true", default=False,
             help="Skip pulling the Venkman repository.")
o.add_option("--skip-calendar", dest="skip_calendar",
             action="store_true", default=False,
             help="Skip pulling the Calendar repository.")

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


def fixup_repo_options(options):
    """ Check options.comm_repo and options.mozilla_repo values;
    populate mozilla_repo if needed.

    options.comm_repo and options.mozilla_repo are normally None.
    This is fine-- our "hg pull" commands will omit the repo URL.
    The exception is the initial checkout, which does an "hg clone"
    for Mozilla.  That command requires a repository URL.
    """

    if (options.comm_repo is None
            and not os.path.exists(os.path.join(topsrcdir, '.hg'))):
        o.print_help()
        print
        print "*** The -m option is required for the initial checkout."
        sys.exit(2)

    # Handle special case: initial checkout of Mozilla.
    if (options.mozilla_repo is None
            and not os.path.exists(os.path.join(topsrcdir, 'mozilla'))):
        options.mozilla_repo = DEFAULT_MOZILLA_REPO

try:
    (options, (action,)) = o.parse_args()
except ValueError:
    o.print_help()
    sys.exit(2)

fixup_repo_options(options)

if action in ('checkout', 'co'):
    if not options.skip_comm:
        do_hg_pull('.', options.comm_repo, options.hg)

    if not options.skip_mozilla:
        do_hg_pull('mozilla', options.mozilla_repo, options.hg)

    if not options.skip_cvs:
        if not options.skip_calendar:
          do_cvs_checkout(CALENDAR_DIRS, CALENDAR_CO_TAG, options.cvsroot, options.cvs, '')
        do_cvs_checkout(LDAPCSDK_DIRS, LDAPCSDK_CO_TAG, options.cvsroot, options.cvs, '')
        if os.path.exists(os.path.join(topsrcdir, 'mozilla', 'extensions')):
          do_cvs_checkout(EXTENSION_DIRS, EXTENSION_CO_TAG, options.cvsroot, options.cvs, 'mozilla')
        else:
          print >>sys.stderr, "Warning: mozilla/extensions does not exist, built-in extensions could not be checked out."
          pass

    if not options.skip_chatzilla:
        if os.path.exists(os.path.join(topsrcdir, 'mozilla', 'extensions')):
          do_cvs_checkout(CHATZILLA_DIRS, CHATZILLA_CO_TAG, options.cvsroot, options.cvs, 'mozilla')
        else:
          print >>sys.stderr, "Warning: mozilla/extensions does not exist, ChatZilla could not be checked out."
          pass

    if not options.skip_venkman:
        if os.path.exists(os.path.join(topsrcdir, 'mozilla', 'extensions')):
          do_cvs_checkout(VENKMAN_DIRS, VENKMAN_CO_TAG, options.cvsroot, options.cvs, 'mozilla')
        else:
          print >>sys.stderr, "Warning: mozilla/extensions does not exist, Venkman could not be checked out."
          pass

else:
    o.print_help()
    sys.exit(2)
