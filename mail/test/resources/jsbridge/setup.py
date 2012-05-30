# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import sys
from setuptools import setup, find_packages

desc = """Python to JavaScript bridge interface."""
summ = """A powerful and extensible Python to JavaScript bridge interface."""

PACKAGE_NAME = "jsbridge"
PACKAGE_VERSION = "2.4.6"

requires = ['mozrunner == 2.5.7']

if not sys.version.startswith('2.6'):
    requires.append('simplejson')

setup(name=PACKAGE_NAME,
      version=PACKAGE_VERSION,
      description=desc,
      long_description=summ,
      author='Mikeal Rogers, Mozilla',
      author_email='mikeal.rogers@gmail.com',
      url='http://github.com/mozautomation/mozmill',
      license='http://www.apache.org/licenses/LICENSE-2.0',
      packages=find_packages(exclude=['test']),
      include_package_data=True,
      package_data = {'': ['*.js', '*.css', '*.html', '*.txt', '*.xpi', '*.rdf', '*.xul', '*.jsm', '*.xml' 'extension'],},
      zip_safe=False,
      entry_points="""
          [console_scripts]
          jsbridge = jsbridge:cli
        """,
      platforms =['Any'],
      install_requires = requires,
      classifiers=['Development Status :: 4 - Beta',
                   'Environment :: Console',
                   'Intended Audience :: Developers',
                   'License :: OSI Approved :: Apache Software License',
                   'Operating System :: OS Independent',
                   'Topic :: Software Development :: Libraries :: Python Modules',
                  ]
     )
