#!/usr/bin/env python

import sys
import os.path
import re
from subprocess import Popen, PIPE
from optparse import OptionParser, OptionValueError
import shlex

o = OptionParser(usage="%prog [options] topsrcdir")

o.add_option("--make", "-m", dest="make",
              action="store", default="make",
              help="Command to invoke make")

o.add_option("--force", "-f", dest="run",
             action="store_true", default=False,
             help="Run client.py no matter what .mozconfig says")

try:
    (options, args) = o.parse_args()
except ValueError:
    o.print_help()
    sys.exit(2)

if len(args) != 1:
    o.print_help()
    sys.exit(2)

topsrcdir = args[0]

client_py_args = []

options_re = re.compile('^mk_add_options:\s+CLIENT_PY_ARGS\s*=\s*(.*)$')
always_run_re = re.compile('^mk_add_options:\s+ALWAYS_RUN_CLIENT_PY\s*=\s*(.*)$')

process = Popen([options.make,'-f', 'client.mk', 'print_mk_add_options', 'NO_CLIENT_PY=1'], stdout=PIPE, stderr=sys.stderr)
output, unused_err = process.communicate()

for line in output.splitlines():
    found_opt = options_re.match(line)
    if found_opt:
        client_py_args = found_opt.group(1)

    found_always = always_run_re.match(line)
    if found_always:
        val = found_always.group(1)
        if val != "0":
            options.run = True

if options.run:
    if not client_py_args:
        print >> sys.stderr, "Can't run client.py without some CLIENT_PY_ARGS in mozconfig"
        sys.exit(1)

    client_py_args = shlex.split(client_py_args)

    #Turn off tinderboxprint when we clone from scratch, we'll shortly afterwards update
    mozilla_dir = os.path.join(topsrcdir, 'mozilla')
    if not os.path.exists(mozilla_dir):
        client_py_args = [arg for arg in client_py_args if arg != '--tinderbox-print']

    cmd = [sys.executable, 'client.py' ] +  client_py_args
    print >> sys.stderr, "Running: %s" % cmd
    # Run the command and redirect output to stderr so make will display it
    p = Popen(cmd,
        stdout=sys.stderr,
        stderr=sys.stderr,
    )
    p.wait()
    print >> sys.stderr, "%s returned %s" % (cmd, p.returncode)
    sys.exit(p.returncode)
