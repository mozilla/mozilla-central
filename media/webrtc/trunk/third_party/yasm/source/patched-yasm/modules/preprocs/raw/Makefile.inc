# $Id: Makefile.inc 2172 2009-01-27 06:38:14Z peter $

libyasm_a_SOURCES += modules/preprocs/raw/raw-preproc.c

YASM_MODULES += preproc_raw

EXTRA_DIST += modules/preprocs/raw/tests/Makefile.inc

include modules/preprocs/raw/tests/Makefile.inc
