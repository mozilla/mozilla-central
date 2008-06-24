
package API_suite;

use strict;

use base qw(Test::Unit::TestSuite);

use Test::Unit::TestRunner;

use lib "..";
use lib "../..";

use Testopia::Test::API::Util;

sub name { 'Testopia API Test Suite' } 

sub include_tests { 
	qw(
	     API_Build
	     API_Environment
	     API_Product
	     API_TestCase
	     API_TestCaseRun
	     API_TestPlan
	     API_TestRun
	  ) 
} 

1;

__END__