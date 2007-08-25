#!gmake
#
# The contents of this file are subject to the Netscape Public
# License Version 1.1 (the "License"); you may not use this file
# except in compliance with the License. You may obtain a copy of
# the License at http://www.mozilla.org/NPL/
#
# Software distributed under the License is distributed on an "AS
# IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
# implied. See the License for the specific language governing
# rights and limitations under the License.
#
# The Original Code is the Tinderbox build tool.
#
# The Initial Developer of the Original Code is Netscape Communications
# Corporation. Portions created by Netscape are
# Copyright (C) 1998 Netscape Communications Corporation. All
# Rights Reserved.
#
# Contributor(s): 


# This Makefile helps you install Tinderbox.  
# Set the variables below to their proper locations.
# TINDERBOX_DIR is the full path to where you want to install tinderbox
# The other variables contain full paths to the utitlies required to
# use tinderbox.

# Then "make install" should copy the files to the tinderbox location
# specified by TINDERBOX_DIR

# Begin SERVER_CONFIGURATION

#TINDERBOX_DIR = /var/www/html/tinderbox

# Set these to the user/group that will run the tinderbox processes
#TINDERBOX_USER = tinderbox
#TINDERBOX_GROUP = tinderbox

#CVSROOT = /cvsroot
#PERL = /usr/bin/perl

SETUID_PATH = '/usr/bin:/bin'

# End SERVER_CONFIGURATION

ALL_UTILS = PERL

EXE_FILES = \
	addimage.cgi \
	addnote.cgi \
	admintree.cgi \
	buildwho.pl \
	clean.pl \
	checksetup.pl \
	doadmin.cgi \
	fixupimages.pl \
	scrape.pl \
	showbuilds.cgi \
	showimages.cgi \
	showlog.cgi \
	warnings.pl \
	$(NULL)

SETUID_SCRIPTS = \
	handlemail.pl \
	processbuild.pl	\
	$(NULL)

FILES = \
	Backwards.pm \
	ep_mac.pl \
	ep_unix.pl \
	ep_windows.pl \
	header.pl \
	imagelog.pl \
	showbuilds.pl \
	tbglobals.pl \
	viewvc.pl \
	Empty.html \
	faq.html \
	index.html \
	examples/buildit.config \
	examples/mozilla-unix.pl \
	examples/mozilla-windows.pl \
	$(NULL)

PICS = \
	1afi003r.gif \
	star.gif \
	$(NULL)

# Sanity check
ifeq (,$(strip $(TINDERBOX_DIR)))
$(error TINDERBOX_DIR must be set to the tinderbox install location)
endif
ifeq (,$(strip $(TINDERBOX_USER)))
$(error TINDERBOX_USER must be set to the user that the tinderbox processes run as)
endif
ifeq (,$(strip $(TINDERBOX_GROUP)))
$(error TINDERBOX_GROUP must be set to the group that the tinderbox processes run as)
endif

install:
	$(foreach u,$(ALL_UTILS),$(if $($u),,$(error $u must be set to the full path of the utility)))
	mkdir -p $(TINDERBOX_DIR)/examples
	set -e ; \
	for I in $(FILES) $(EXE_FILES) $(SETUID_SCRIPTS); do \
	  echo Installing $$I && \
          sed -e s#/usr/bonsaitools/bin/perl#$(PERL)#g \
              -e s#@CVSROOT@#$(CVSROOT)#g \
              -e s#@TINDERBOX_DIR@#$(TINDERBOX_DIR)#g \
              -e s#@SETUID_PATH@#$(SETUID_PATH)#g \
              $$I > $(TINDERBOX_DIR)/$$I && \
	   chmod 644 $(TINDERBOX_DIR)/$$I; \
	done
	chmod 755 $(addprefix $(TINDERBOX_DIR)/,$(EXE_FILES))
	chmod 4755 $(addprefix $(TINDERBOX_DIR)/,$(SETUID_SCRIPTS))
	set -e ; \
	for I in $(PICS); do \
	  echo Installing $$I && \
	  cp $$I $(TINDERBOX_DIR) && \
	  chmod 644 $(TINDERBOX_DIR)/$$I; \
	done
	mkdir -p $(TINDERBOX_DIR)/data/bad
	chown -R $(TINDERBOX_USER) $(TINDERBOX_DIR)
	chgrp -R $(TINDERBOX_GROUP) $(TINDERBOX_DIR)
	chmod 755 $(TINDERBOX_DIR)
	chmod 770 $(TINDERBOX_DIR)/data
	chmod 770 $(TINDERBOX_DIR)/data/bad
	chmod 770 $(TINDERBOX_DIR)/examples

define READPASS
$(PERL) -e ' \
use Digest::MD5 qw(md5_hex); \
use Term::ReadKey; \
open(PASSWD, ">$1") or die "$1:$$!\n"; \
print "Enter the new admin password: "; \
ReadMode("noecho"); \
chomp($$pass = ReadLine(0)); \
print "\n"; \
ReadMode(0); \
print PASSWD md5_hex($$pass); \
close(PASSWD);'
endef

genpasswd:
	@$(call READPASS,$(TINDERBOX_DIR)/data/passwd)
	@chown $(TINDERBOX_USER) $(TINDERBOX_DIR)/data/passwd
	@chgrp $(TINDERBOX_USER) $(TINDERBOX_DIR)/data/passwd
