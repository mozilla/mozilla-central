#!/usr/bin/env python

import sys
import os.path
import re
from subprocess import Popen, PIPE
import shlex

topsrcdir = sys.argv[1]

run = False

if len(sys.argv) >= 3:
    run = True

client_py_args = []

options_re = re.compile('^mk_add_options:\s+CLIENT_PY_ARGS\s*=\s*(.*)$')
always_run_re = re.compile('^mk_add_options:\s+ALWAYS_RUN_CLIENT_PY\s*=\s*(.*)$')

process = Popen(['build/print_mk_add_options.sh'], stdout=PIPE, stderr=sys.stderr)
output, unused_err = process.communicate()

for line in output.splitlines():
    found_opt = options_re.match(line)
    if found_opt:
        client_py_args = found_opt.group(1)

    found_always = always_run_re.match(line)
    if found_always:
        val = found_always.group(1)
        if val != "0":
            run = True

if run:
    if not client_py_args:
        print >> sys.stderr, "Can't run client.py without some CLIENT_PY_ARGS in mozconfig"
        sys.exit(1)
    cmd = [sys.executable, 'client.py' ] + shlex.split(client_py_args)
    print >> sys.stderr, "Running: %s" % cmd
    # Run the command and redirect output to stderr so make will display it
    p = Popen(cmd,
        stdout=sys.stderr,
        stderr=sys.stderr,
    )
    p.wait()
    print >> sys.stderr, "%s returned %s" % (cmd, p.returncode)
    sys.exit(p.returncode)
