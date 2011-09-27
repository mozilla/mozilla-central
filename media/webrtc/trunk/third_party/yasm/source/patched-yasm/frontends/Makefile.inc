# $Id: Makefile.inc 2284 2010-02-06 09:27:32Z peter $

EXTRA_DIST += frontends/yasm/Makefile.inc
EXTRA_DIST += frontends/tasm/Makefile.inc
EXTRA_DIST += frontends/vsyasm/Makefile.inc

include frontends/yasm/Makefile.inc
include frontends/tasm/Makefile.inc
include frontends/vsyasm/Makefile.inc
