#!/usr/bin/python

EXTENSION_CO_TAG = 'HEAD'
LDAPCSDK_CO_TAG = 'LDAPCSDK_6_0_6_RTM'

CHATZILLA_CO_TAG = 'HEAD'
VENKMAN_CO_TAG = 'HEAD'

EXTENSION_DIRS = ('extensions/typeaheadfind',
                  'extensions/wallet',)
LDAPCSDK_DIRS = ('directory/c-sdk',)

CHATZILLA_DIRS = ('extensions/irc',)
VENKMAN_DIRS = ('extensions/venkman',)

DEFAULT_COMM_REV = "tip"
# URL of the default hg repository to clone for Mozilla.
DEFAULT_MOZILLA_REPO = 'http://hg.mozilla.org/mozilla-central/'
DEFAULT_MOZILLA_REV = "tip"
# URL of the default hg repository to clone for inspector.
DEFAULT_INSPECTOR_REPO = 'http://hg.mozilla.org/dom-inspector/'
DEFAULT_INSPECTOR_REV = "tip"

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
    """Check out a CVS directory into the mozilla/ subdirectory.
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

o.add_option("--skip-cvs", dest="skip_cvs",
             action="store_true", default=False,
             help="Skip pulling the old directories from the Mozilla CVS repository.")
o.add_option("--skip-ldap", dest="skip_ldap",
             action="store_true", default=False,
             help="Skip pulling LDAP from the Mozilla CVS repository.")
o.add_option("--skip-chatzilla", dest="skip_chatzilla",
             action="store_true", default=False,
             help="Skip pulling the ChatZilla repository.")
o.add_option("--skip-venkman", dest="skip_venkman",
             action="store_true", default=False,
             help="Skip pulling the Venkman repository.")

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

    # Handle special case: initial checkout of inspector.
    if (options.inspector_repo is None
            and not os.path.exists(os.path.join(topsrcdir, 'mozilla', 'extensions', 'inspector'))):
        options.inspector_repo = DEFAULT_INSPECTOR_REPO

try:
    (options, (action,)) = o.parse_args()
except ValueError:
    o.print_help()
    sys.exit(2)

fixup_repo_options(options)

if action in ('checkout', 'co'):
    if not options.skip_comm:
        do_hg_pull('.', options.comm_repo, options.hg, options.comm_rev)

    if not options.skip_mozilla:
        do_hg_pull('mozilla', options.mozilla_repo, options.hg, options.mozilla_rev)

    if not options.skip_inspector:
        do_hg_pull(os.path.join('mozilla', 'extensions', 'inspector'), options.inspector_repo, options.hg, options.inspector_rev)

    if not options.skip_cvs:
        if not options.skip_ldap:
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
