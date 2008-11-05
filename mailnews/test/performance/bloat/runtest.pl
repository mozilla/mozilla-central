#!/usr/bin/env perl
use strict;
use File::Spec;
use File::Path qw(rmtree mkpath);
use FindBin qw($Bin);

system("python", File::Spec->catfile($Bin, "runtest.py"), @ARGV);
