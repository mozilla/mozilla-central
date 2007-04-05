#!/usr/bin/python

"""A script which will import from Mozilla CVS into a Mercurial
repository. It pulls NSPR and NSS from the appropriate release tags
currently in use on the Mozilla trunk."""

from sys import exit
from os import environ, makedirs, listdir, rename, unlink
from os.path import isdir
from shutil import rmtree
from tempfile import mkdtemp
try:
    from subprocess import check_call
except ImportError:
    # Python 2.4 doesn't have check_call, so we reimplement it
    from subprocess import call
    def check_call(*popenargs, **kwargs):
        retcode = call(*popenargs, **kwargs)
        if retcode:
            cmd = kwargs.get("args")
            if cmd is None:
                cmd = popenargs[0]
            raise Exception("Command '%s' returned non-zero exit status %d" % (cmd, retcode))

mozilla_files = (
    "Makefile.in",
    "LICENSE",
    "LEGAL",
    "README.txt",
    "accessible",
    "aclocal.m4",
    "allmakefiles.sh",
    "browser",
    "build",
    "caps",
    "chrome",
    "config",
    "configure.in",
    "client.mk",
    "content",
    "db",
    "docshell",
    "dom",
    "editor",
    "embedding",
    "extensions/Makefile.in",
    "extensions/access-builtin",
    "extensions/auth",
    "extensions/canvas3d",
    "extensions/cookie",
    "extensions/gnomevfs",
    "extensions/inspector",
    "extensions/java",
    "extensions/jssh",
    "extensions/layout-debug",
    "extensions/metrics",
    "extensions/negotiateauth",
    "extensions/permissions",
    "extensions/pref",
    "extensions/python",
    "extensions/reporter",
    "extensions/spellcheck",
    "extensions/universalchardet",
    "gfx",
    "intl",
    "ipc",
    "jpeg",
    "js",
    "layout",
    "modules",
    "netwerk",
    "other-licenses/7zstub",
    "other-licenses/atk-1.0",
    "other-licenses/branding/firefox",
    "other-licenses/bsdiff",
    "other-licenses/ia2",
    "parser",
    "plugin",
    "profile",
    "rdf",
    "security/manager",
    "storage",
    "sun-java",
    "testing",
    "toolkit",
    "tools/build",
    "tools/codesighs",
    "tools/cross-commit",
    "tools/elf-dynstr-gc",
    "tools/footprint",
    "tools/httptester",
    "tools/jprof",
    "tools/l10n",
    "tools/leaky",
    "tools/memory",
    "tools/page-loader",
    "tools/patcher",
    "tools/performance",
    "tools/rb",
    "tools/release",
    "tools/relic",
    "tools/reorder",
    "tools/test-harness",
    "tools/tests",
    "tools/testserver",
    "tools/testy",
    "tools/trace-malloc",
    "tools/update-packaging",
    "tools/uuiddeps",
    "uriloader",
    "view",
    "webshell",
    "widget",
    "xpcom",
    "xpfe",
    "xpinstall",
    "xulrunner"
    )

nspr_files = ("nsprpub",)
nspr_tag = "NSPRPUB_PRE_4_2_CLIENT_BRANCH"

nss_files = (
    "dbm",
    "security/nss",
    "security/coreconf",
    "security/dbm"
    )
nss_tag = "NSS_3_11_5_RTM"

def ensurevalue(val, envvar, default = None):
    if val:
        return val

    if envvar in environ:
        return environ[envvar]

    if default:
        return default

    raise ValueError("No %s found." % envvar)

def rmfileortree(path):
    print "Removing %s" % path
    if isdir(path):
        rmtree(path)
    else:
        unlink(path)

def CheckoutDirs(directory, branch, cvsroot, dirlist):
    arglist = ['cvs', '-Q', '-d', cvsroot, 'co', '-P', '-N']
    if branch is not None:
        arglist.extend(['-r', branch])

    arglist.extend(["mozilla/%s" % dir for dir in dirlist])
    check_call(arglist, cwd=directory)

def ImportMozillaCVS(directory, cvsroot=None, hg=None, tempdir=None):
    cvsroot = ensurevalue(cvsroot, "CVSROOT", ":pserver:anonymous@cvs-mirror.mozilla.org:/cvsroot")
    
    tempd = mkdtemp("cvsimport", dir=tempdir)

    try:
        CheckoutDirs(tempd, nspr_tag, cvsroot, nspr_files)
        CheckoutDirs(tempd, nss_tag, cvsroot, nss_files)
        CheckoutDirs(tempd, None, cvsroot, mozilla_files)

        # Remove everything in the hg repository except for the .hg directory
        for f in listdir(directory):
            if f != ".hg" and f != ".hgignore":
                rmfileortree("%s/%s" % (directory, f))

        # Move everything from the mozilla/ directory to the hg repo
        for f in listdir("%s/mozilla" % tempd):
            source = "%s/mozilla/%s" % (tempd, f)
            dest = "%s/%s" % (directory, f)
            print "Moving %s to %s" % (source, dest)
            rename(source, dest)

        check_call(['hg', '-q', 'add'], cwd=directory)
        check_call(['hg', '-q', 'remove', '--after'], cwd=directory)

        check_call(['hg', '-q', 'commit', '-m', 'Automated import from CVS.'],
                   cwd=directory)

    finally:
        rmtree(tempd)

def InitRepo(directory, hg=None):
    hg = ensurevalue(hg, "HG", "hg")
    check_call([hg, 'init', directory])

    ignoref = open("%s/.hgignore" % directory, "wb")
    print >>ignoref, "CVS\n\\.cvsignore"
    ignoref.close()

    check_call([hg, 'add', '.hgignore'], cwd=directory)
    check_call([hg, 'commit', '-m', 'Set up .hgignore to ignore CVS files.'],
               cwd=directory)

if __name__ == '__main__':
    from optparse import OptionParser

    usage = "usage: %prog [options] directory"
    p = OptionParser()
    p.add_option("--cvsroot", dest="cvsroot",
                 help="Specify the CVSROOT for checkout.")
    p.add_option("--hg", dest="hg",
                 help="Path to the hg executable.")
    p.add_option("--initrepo", dest="initrepo", action="store_true",
                 help="Initialize a repository for import.")
    p.add_option("--tempdir", dest="tempdir",
                 help="Use a specific directory for temporary files.")

    (options, args) = p.parse_args()

    if len(args) != 1:
        p.print_help()
        exit(1)

    if options.initrepo:
        print "Initializing hg repository '%s'." % args[0]
        InitRepo(args[0], options.hg)
        print "Initialization successful."
    else:
        print "Importing CVS to repository '%s'." % args[0]
        ImportMozillaCVS(args[0], options.hg, options.cvsroot, options.tempdir)
        print "Import successful."
