# The entire tree should be subject to static analysis using the XPCOM
# script. Additional scripts may be added by specific subdirectories.

DEHYDRA_SCRIPT = $(MOZILLA_SRCDIR)/config/static-checking.js

DEHYDRA_MODULES = \
  $(MOZILLA_SRCDIR)/xpcom/analysis/final.js \
  $(NULL)

TREEHYDRA_MODULES = \
  $(MOZILLA_SRCDIR)/xpcom/analysis/outparams.js \
  $(MOZILLA_SRCDIR)/xpcom/analysis/stack.js \
  $(MOZILLA_SRCDIR)/xpcom/analysis/flow.js \
  $(MOZILLA_SRCDIR)/js/src/jsstack.js \
  $(NULL)

DEHYDRA_ARGS = \
  --topsrcdir=$(topsrcdir) \
  --objdir=$(MOZDEPTH) \
  --dehydra-modules=$(subst $(NULL) ,$(COMMA),$(strip $(DEHYDRA_MODULES))) \
  --treehydra-modules=$(subst $(NULL) ,$(COMMA),$(strip $(TREEHYDRA_MODULES))) \
  $(NULL)

DEHYDRA_FLAGS = -fplugin=$(DEHYDRA_PATH) -fplugin-arg='$(DEHYDRA_SCRIPT) $(DEHYDRA_ARGS)'

ifdef DEHYDRA_PATH
OS_CXXFLAGS += $(DEHYDRA_FLAGS)
endif
