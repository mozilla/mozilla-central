# Copyright 2010 Google Inc.
# All Rights Reserved.
# Author: thaloun@google.com (Tim Haloun)

"""Tools that we need to include with libjingle."""

import subprocess


# We need this in libjingle because main.scons depends on it and
# libjingle depends on main.scons.
def EnableFeatureWherePackagePresent(env, bit, cpp_flag, package):
  """Enable a feature if a required pkg-config package is present.

  Args:
    env: The current SCons environment.
    bit: The name of the Bit to enable when the package is present.
    cpp_flag: The CPP flag to enable when the package is present.
    package: The name of the package.
  """
  if not env.Bit('host_linux'):
    return
  if _HavePackage(package):
    env.SetBits(bit)
    env.Append(CPPDEFINES = [cpp_flag])
  else:
    print ('Warning: Package \"%s\" not found. Feature \"%s\" will not be '
           'built. To build with this feature, install the package that '
           'provides the \"%s.pc\" file.') % (package, bit, package)


def _HavePackage(package):
  """Whether the given pkg-config package name is present on the build system.

  Args:
    package: The name of the package.

  Returns:
    True if the package is present, else False
  """
  return subprocess.call(['pkg-config', '--exists', package]) == 0


def generate(env):  # pylint: disable-msg=C6409
  env.AddMethod(EnableFeatureWherePackagePresent)


def exists(env):  # pylint: disable-msg=C6409,W0613
  return 1
