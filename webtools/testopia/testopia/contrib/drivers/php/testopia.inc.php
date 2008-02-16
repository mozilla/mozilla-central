<?php
// PHP library to access Testopia XML-RPC API
// by Holger Sickenberg
// holgi@novell.com
//
// Version: Tue Jul  3 12:12:58 CEST 2007
//
// Include XML-RPC Library
include_once(".xmlrpc.inc.php");


// Define Server environment

// Server
// Production Server
// $client = new xmlrpc_client("/tr_xmlrpc.cgi", "apibugzilla.novell.com", 443, "https");
// Testserver
$client = new xmlrpc_client("/tr_xmlrpc.cgi", "apibugzillastage.provo.novell.com", 443, "https");

// Username and Password (Must be defined in calling script)
// $username = "";
// $password = "";
$client->setCredentials($username, $password);

// SSL Verify Peer
// $client->setSSLVerifyPeer(FALSE);
$client->setSSLVerifyPeer(TRUE);

// Debug on/off
$client->setDebug(0);


// Functions

function do_call($call) {
	global $client;
	// Do call and handle feedback
	if (!($res = $client->send($call))) {
		print "Could not connect to HTTPS server.";
		return FALSE;
	}
	if ($res->faultCode() == 0) {
		$value = $res->value();
		return php_xmlrpc_decode($value);
	}
	else {
		print "XML-RPC Fault #" . $res->faultCode() . ": " .  $res->faultString();
		return FALSE;
	}
}

/*
 * * * Build * * *

Attributes
Attribute	Data Type
build_id	integer
product_id	integer
name		string
description	string
milestone	string
isactive	boolean
*/

/*
get - Get A Build by ID

Usage
Build.get

Parameters
Parameter	Data Type	Comments
build_id	integer		Must be greater than 0.

Return
Array:
[build_id]
[product_id]
[name]
[milestone]
[isactive]
[description]
*/
function Build_get($build_id) {
	// Create call
	$call = new xmlrpcmsg('Build.get', array(new xmlrpcval($build_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
create - Create A New Build

Usage
Build.create

Parameters
Parameter	Data Type	Comments
new_values	hashmap		See required attributes list below.

Required attributes: name and product_id.

Return
build_id
*/
function Build_create($product_id, $name, $description = NULL, $milestone = NULL, $isactive = TRUE) {
	$varray = array("product_id" => "int", "name" => "string", "description" => "string", "milestone" => "string", "isactive" => "int");
	foreach($varray as $key => $val) {
		if (isset(${$key})) {
			$carray[$key] = new xmlrpcval(${$key}, $val);
		}
	}
	// Create call
	$call = new xmlrpcmsg('Build.create', array(new xmlrpcval($carray, "struct")));

	// Do call and return value
	return do_call($call);
}

/*
update - Update An Existing Build

Usage
Build.update

Parameters
Parameter	Data Type	Comments
build_id	integer	
new_values	hashmap		build_id and product_id can not be modified.

Return
Array:
[build_id]
[name]
[milestone]
[isactive]
[description]
*/
function Build_update($build_id, $name, $description = NULL, $milestone = NULL, $isactive = TRUE) {
	$varray = array("name" => "string", "description" => "string", "milestone" => "string", "isactive" => "int");
	foreach($varray as $key => $val) {
		if (isset(${$key})) {
			$carray[$key] = new xmlrpcval(${$key}, $val);
		}
	}
	// Create call
	$call = new xmlrpcmsg('Build.update', array(new xmlrpcval($build_id, "int"), new xmlrpcval($carray, "struct")));

	// Do call and return value
	return do_call($call);
}

/*
lookup_id_by_name - Lookup A Build ID By Its Name

Usage
Build.lookup_id_by_name

Parameters
Parameter	Data Type	Comments
name		string		Cannot be null or empty string

Return
build_id
*/
function Build_lookup_id_by_name($name) {
	// Create call
	$call = new xmlrpcmsg('Build.lookup_id_by_name', array(new xmlrpcval($name, "string")));

	// Do call and return value
	return do_call($call);
}

/*
lookup_name_by_id - Lookup A Build Name By Its ID

Usage
Build.lookup_name_by_id

Parameters
Parameter	Data Type	Comments
id		integer		Cannot be 0

Return
name
*/
function Build_lookup_name_by_id($build_id) {
	// Create call
	$call = new xmlrpcmsg('Build.lookup_name_by_id', array(new xmlrpcval($build_id, "int")));

	// Do call and return value
	return do_call($call);
}


/*
 * * * Component * * *

Attributes
Attribute		Data Type
description		string
component_id		integer
initialowner		integer
initialqacontact	integer
name			String
product_id		integer
product_name		string
*/

/*
get - Get A Component by ID

Usage
Component.get

Parameters
Parameter	Data Type	Comments
component_id	integer		Must be greater than 0.

Return
Array:
[initialowner]
[disallownew]
[product_id]
[name]
[id]
[description]
[initialqacontact]
*/
function Component_get($component_id) {
	// Create call
	$call = new xmlrpcmsg('Component.get', array(new xmlrpcval($component_id, "int")));

	// Do call and return value
	return do_call($call);
}


/*
 * * * Environment * * *

Attributes
Attribute	Data Type
environment_id	integer
isactive	integer
name		string
product_id	integer
*/

/*
get - Get An Environment by ID

Usage
Environment.get

Parameters
Parameter	Data Type	Comments
environment_id	integer		Must be greater than 0.

Result
Array
[environment_id]
[product_id]
[name]
[isactive]
[product]
  Array
  [defaultmilestone]
  [votesperuser]
  [disallownew]
  [name]
  [maxvotesperbug]
  [milestoneurl]
  [classification_id]
  [description]
  [votestoconfirm]
  [id]

*/
function Environment_get($environment_id) {
	// Create call
	$call = new xmlrpcmsg('Environment.get', array(new xmlrpcval($environment_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
list - Get A List of Environments Based on A Query

Usage
Environment.list

Parameters
Parameter	Data Type	Comments
query		hashmap		Can not be null.

Result
Array
[0]
  Array
  [environment_id]
  [product_id]
  [name]
  [isactive]
[1]
  Array
  ...
*/
function Environment_list($query) {
	// Create array
	foreach($query as $key => $val) {
		switch($key) {
			case "environment_id":
			case "isactive":
			case "product_id":
				$type = "int";
				break;
			case "name":
			default:
				$type = "string";
		}
		$qarray[$key] = new xmlrpcval($val, $type);
	}

	// Create call
	$call = new xmlrpcmsg('Environment.list', array(new xmlrpcval($qarray, "struct")));

	// Do call and return value
	return do_call($call);
}

/*
create - Create A New Environment

Usage
Environment.create

Parameters
Parameter	Data Type	Comments
new_values	hashmap		See required attributes list1 below.

Required attributes: isactive and product_id

Result
environment_id
*/
function Environment_create($isactive, $product_id, $name = NULL) {
	$varray = array("isactive" => "int", "product_id" => "int", "name" => "string");
	foreach($varray as $key => $val) {
		if (isset(${$key})) {
			$carray[$key] = new xmlrpcval(${$key}, $val);
		}
	}
	// Create call
	$call = new xmlrpcmsg('Environment.create', array(new xmlrpcval($carray, "struct")));

	// Do call and return value
	return do_call($call);
}

/*
update - Update An Existing Environment

Usage
Environment.update

Parameters
Parameter	Data Type	Comments
environment_id	integer	
new_values	hashmap		environment_id can not be modified.

Result
Array
[environment_id]
[product_id]
[isactive]
[name]
*/
function Environment_update($environment_id, $isactive, $product_id = NULL, $name = NULL) {
	$varray = array("isactive" => "int", "product_id" => "int", "name" => "string");
	foreach($varray as $key => $val) {
		if (isset(${$key})) {
			$carray[$key] = new xmlrpcval(${$key}, $val);
		}
	}
	// Create call
	$call = new xmlrpcmsg('Environment.update', array(new xmlrpcval($environment_id, "int"), new xmlrpcval($carray, "struct")));

	// Do call and return value
	return do_call($call);
}

/*
get_runs - Get A List of TestRuns For An Existing Environment

Usage
Environment.get_runs

Parameters
Parameter	Data Type
environment_id	integer

Result
Array
[0]
  Array
  [build_id]
  [plan_text_version]
  [manager_id]
  [stop_date]
  [run_id]
  [plan_id]
  [product_version]
  [environment_id]
  [summary]
  [notes]
  [start_date]
[1]
  Array
  ...
*/
function Environment_get_runs($environment_id) {
	// Create call
	$call = new xmlrpcmsg('Environment.get_runs', array(new xmlrpcval($environment_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
 * * * Product * * *

Attributes
Attribute		Data Type
product_id		integer
name			string
description		string
milestone_url		string
disallow_new		integer
votes_per_user		integer
max_votes_per_bug	integer
votes_to_confirm	integer
default_milestone	string
classification_id	integer

*/
/*
lookup_id_by_name - Lookup A Product ID By Its Name

Usage
Product.lookup_id_by_name

Parameters
Parameter	Data Type	Comments
name		string		Cannot be null or empty string

Return
product_id
*/
function Product_lookup_id_by_name($name) {
	// Create call
	$call = new xmlrpcmsg('Product.lookup_id_by_name', array(new xmlrpcval($name, "string")));

	// Do call and return value
	return do_call($call);
}

/*
lookup_name_by_id - Lookup A Product Name By Its ID

Usage
Product.lookup_name_by_id

Parameters
Parameter	Data Type	Comments
product_id	integer		Cannot be 0

Return
name
*/
function Product_lookup_name_by_id($product_id) {
	// Create call
	$call = new xmlrpcmsg('Product.lookup_name_by_id', array(new xmlrpcval($product_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
get_milestones - Get a list of milestones for the given Product

Usage
Product.get_milestones

Parameters
Parameter	Data Type	Comments
product_id	integer		Cannot be 0

Result
Array
[0]
  Array
  [name]
  [id]
[1]
  Array
  ...

*/
function Product_get_milestones($product_id) {
	// Create call
	$call = new xmlrpcmsg('Product.get_milestones', array(new xmlrpcval($product_id, "int")));

	// Do call and return value
	return do_call($call);
}


/*
 * * * User * * *

Attributes
Attribute	Data Type
user_id		integer
login		integer
email		string
name		string
disabledtext	string
is_disabled	integer
showmybugslink	integer
*/

/*
lookup_id_by_login - Lookup A User ID By Its Login

Usage
User.lookup_id_by_login

Parameters
Parameter	Data Type	Comments
login		string		Cannot be null or empty string

Return
user_id
*/
function User_lookup_id_by_login($login) {
	// Create call
	$call = new xmlrpcmsg('User.lookup_id_by_login', array(new xmlrpcval($login, "string")));

	// Do call and return value
	return do_call($call);
}

/*
lookup_login_by_id - Lookup A Login By Its ID

Usage
User.lookup_login_by_id

Parameters
Parameter	Data Type	Comments
user_id		integer		Cannot be 0

Return
login
*/
function User_lookup_login_by_id($user_id) {
	// Create call
	$call = new xmlrpcmsg('User.lookup_login_by_id', array(new xmlrpcval($user_id, "int")));

	// Do call and return value
	return do_call($call);
}


/*
 * * * Tag * * *

Attributes
Attribute	Data Type
tag_id		integer
tag_name	string
case_count	integer
plan_count	integer
run_count	integer
*/


/*
 * * * TestPlan * * *

Attributes
Attribute		Data Type	Comments
author_id		integer		(Read Only?)
default_product_version	string
creation_date		string		Format: yyyy-mm-dd hh:mm:ss (Read Only?)
isactive		integer
name			string
plan_id			integer
product_id		integer
type_id			integer
*/

/*
get - Get A TestPlan by ID

Usage
TestPlan.get

Parameters
Parameter	Data Type	Comments
plan_id		integer		Must be greater than 0.

Return
Array
  [author_id]
  [name]
  [default_product_version]
  [plan_id]
  [product_id]
  [creation_date]
  [type_id]
  [isactive]
*/
function TestPlan_get($plan_id) {
	// Create call
	$call = new xmlrpcmsg('TestPlan.get', array(new xmlrpcval($plan_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
list - Get A List of TestPlans Based on A Query

Usage
TestPlan.list

Parameters
Parameter	Data Type	Comments
query		hashmap		Can not be null. See Query Examples.

See https://wiki.innerweb.novell.com/index.php/Bugzilla_XML-RPC_API_Query_Examples

Return
Array
[0]
  Array
  [author_id] => 4813
  [name] => Testopia phplib Testplan3
  [default_product_version] => Alpha 2
  [plan_id] => 543
  [product_id] => 332
  [creation_date] => 2007-06-29 03:45:40
  [type_id] => 8
  [isactive]
[1]
  Array
  ...
*/
function TestPlan_list($query) {
	// Create array
	foreach($query as $key => $val) {
		switch($key) {
			case "author_id":
			case "isactive":
			case "plan_id":
			case "product_id":
			case "type_id":
				$type = "int";
				break;
			case "default_product_version":
			case "creation_date":
			case "name":
			default:
				$type = "string";
		}
		$qarray[$key] = new xmlrpcval($val, $type);
	}

	// Create call
	$call = new xmlrpcmsg('TestPlan.list', array(new xmlrpcval($qarray, "struct")));

	// Do call and return value
	return do_call($call);
}

/*
create - Create A New TestPlan

Usage
TestPlan.create

Parameters
Parameter	Data Type	Comments
new_values	hashmap		See required attributes list below.

Required attributes: author_id, product_id, default_product_version, type_id, and name.

Result
plan_id
*/
function TestPlan_create($author_id, $product_id, $default_product_version, $type_id, $name, $creation_date = NULL, $isactive = TRUE) {
	$varray = array("author_id" => "int", "product_id" => "int", "default_product_version" => "string", "type_id" => "int", "name" => "string", "creation_date" => "string", "isactive" => "int");
	foreach($varray as $key => $val) {
		if (isset(${$key})) {
			$carray[$key] = new xmlrpcval(${$key}, $val);
		}
	}
	// Create call
	$call = new xmlrpcmsg('TestPlan.create', array(new xmlrpcval($carray, "struct")));

	// Do call and return value
	return do_call($call);
}
/*
update - Update An Existing TestPlan

Usage
TestPlan.update

Parameters
Parameter	Data Type	Comments
plan_id		integer	
new_values	hashmap	plan_id can not be modified.

Result
Array
[author_id]
[test_case_count]
[name]
[default_product_version]
[test_run_count]
[plan_id]
[product_id]
[creation_date]
[type_id]
[isactive]
[product]
  Array
  [defaultmilestone]
  [votesperuser]
  [disallownew]
  [name]
  [maxvotesperbug]
  [milestoneurl]
  [classification_id]
  [description]
  [votestoconfirm]
  [id]
*/
function TestPlan_update($plan_id, $author_id, $product_id = NULL, $default_product_version = NULL, $type_id = NULL, $name = NULL, $creation_date = NULL, $isactive = TRUE) {
	$varray = array("author_id" => "int", "product_id" => "int", "default_product_version" => "string", "type_id" => "int", "name" => "string", "creation_date" => "string", "isactive" => "int");
	foreach($varray as $key => $val) {
		if (isset(${$key})) {
			$carray[$key] = new xmlrpcval(${$key}, $val);
		}
	}
	// Create call
	$call = new xmlrpcmsg('TestPlan.update', array(new xmlrpcval($plan_id, "int"), new xmlrpcval($carray, "struct")));

	// Do call and return value
	return do_call($call);
}

/*
get_categories - Get A List of Categories For An Existing Test Plan

Usage
TestPlan.get_categories

Parameters
Parameter	Data Type	Comments
plan_id		integer

Return
Array
[0]
  Array
  [category_id]
  [product_id]
  [name]
  [description]
[1]
  Array
  ...
*/
function TestPlan_get_categories($plan_id) {
	// Create call
	$call = new xmlrpcmsg('TestPlan.get_categories', array(new xmlrpcval($plan_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
get_builds - Get A List of Builds For An Existing Test Plan

Usage
TestPlan.get_builds

Parameters
Parameter	Data Type	Comments
plan_id		integer

Result
Array
[0]
  Array
  [build_id]
  [product_id]
  [name]
  [milestone]
  [isactive]
  [description]
[1]
  Array
  ...
*/
function TestPlan_get_builds($plan_id) {
	// Create call
	$call = new xmlrpcmsg('TestPlan.get_builds', array(new xmlrpcval($plan_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
get_components - Get A List of Components For An Existing Test Plan

Usage
TestPlan.get_components

Parameters
Parameter	Data Type	Comments
plan_id		integer

Result
Array
[0]
  Array
  [initialowner]
  [disallownew]
  [product_id]
  [name]
  [id]
  [description]
  [initialqacontact]
[1]
  Array
  ...
*/
function TestPlan_get_components($plan_id) {
	// Create call
	$call = new xmlrpcmsg('TestPlan.get_components', array(new xmlrpcval($plan_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
get_test_cases - Get A List of Test Cases For An Existing Test Plan
Usage

TestPlan.get_test_cases
Parameters
Parameter	Data Type	Comments
plan_id		integer

Result
Array
[0]
  Array
  [author_id]
  [script]
  [sortkey]
  [case_id]
  [estimated_time]
  [case_status_id]
  [default_tester_id]
  [priority_id]
  [requirement]
  [category_id]
  [creation_date]
  [summary]
  [isautomated]
  [arguments]
  [alias]
[1]
  Array
  ...
*/
function TestPlan_get_test_cases($plan_id) {
	// Create call
	$call = new xmlrpcmsg('TestPlan.get_test_cases', array(new xmlrpcval($plan_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
get_test_runs - Get A List of Test Runs For An Existing Test Plan

Usage
TestPlan.get_test_runs

Parameters
Parameter	Data Type
plan_id		integer

Result
Array
[0]
  Array
  [build_id]
  [plan_text_version]
  [manager_id]
  [stop_date]
  [run_id]
  [plan_id]
  [product_version]
  [environment_id]
  [summary]
  [notes]
  [start_date]
[1]
  Array
  ...
*/
function TestPlan_get_test_runs($plan_id) {
	// Create call
	$call = new xmlrpcmsg('TestPlan.get_test_runs', array(new xmlrpcval($plan_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
add_tag - Add a tag to the given TestPlan

Usage
TestPlan.add_tag

Parameters
Parameter	Data Type	Comments
plan_id		integer	
tag_name	string		Creates tag if it does not exist

Result
!== FALSE
*/

function TestPlan_add_tag($plan_id, $tag_name) {
	// Create call
	$call = new xmlrpcmsg('TestPlan.add_tag', array(new xmlrpcval($plan_id, "int"), new xmlrpcval($tag_name, "string")), "array");

	// Do call and return value
	return do_call($call);
}

/*
remove_tag - Remove a tag from the given TestPlan

Usage
TestPlan.remove_tag

Parameters
Parameter	Data Type
plan_id		integer	
tag_name	string	

Result
0
*/
function TestPlan_remove_tag($plan_id, $tag_name) {
	// Create call
//	$call = new xmlrpcmsg('TestPlan.remove_tag', array(new xmlrpcval(array("plan_id" => new xmlrpcval($plan_id, "int"), "tag_name" => new xmlrpcval($tag_name, "string")), "struct")));
	$call = new xmlrpcmsg('TestPlan.remove_tag', array(new xmlrpcval($plan_id, "int"), new xmlrpcval($tag_name, "string")));

	// Do call and return value
	return do_call($call);
}

/*
get_tags - Get a list of tags for the given TestPlan

Usage
TestPlan.get_tags

Parameters
Parameter	Data Type
plan_id		integer

Result
Array
[0]
  [plan_count]
  [tag_name]
  [case_count]
  [run_count]
  [tag_id]
[1]
  Array
  ...
*/
function TestPlan_get_tags($plan_id) {
	// Create call
	$call = new xmlrpcmsg('TestPlan.get_tags', array(new xmlrpcval($plan_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
lookup_type_id_by_name - Lookup A TestPlan Type ID By Its Name

Usage
TestPlan.lookup_type_id_by_name

Parameters
Parameter	Data Type	Comments
name		string		Cannot be null or empty string

Result
type_id
*/
function TestPlan_lookup_type_id_by_name($name) {
	// Create call
	$call = new xmlrpcmsg('TestPlan.lookup_type_id_by_name', array(new xmlrpcval($name, "string")));

	// Do call and return value
	return do_call($call);
}

/*
lookup_type_name_by_id - Lookup A TestPlan Type Name By Its ID

Usage
TestPlan.lookup_type_name_by_id

Parameters
Parameter	Data Type	Comments
id		integer	Cannot be 0

Result
name
*/
function TestPlan_lookup_type_name_by_id($type_id) {
	// Create call
	$call = new xmlrpcmsg('TestPlan.lookup_type_name_by_id', array(new xmlrpcval($type_id, "int")));

	// Do call and return value
	return do_call($call);
}


/*
 * * * TestCase * * *

Attributes
Attribute		Data Type			Comments
alias			string
arguments		string
author_id		integer
canview			integer				Read Only
case_id			integer
case_status_id		integer
category_id		integer
creation_date		string				Format: yyyy-mm-dd hh:mm:ss
default_tester_id	integer
isautomated		integer
plans			Array of TestPlan hashmaps	Read Only
priority_id		integer
requirement		string
script			string
summary			string
sortkey			integer
*/

/*
get - Get A TestCase by ID

Usage
TestCase.get

Parameters
Parameter	Data Type	Comments
case_id		integer		Must be greater than 0.

Result
Array
[author_id]
[script]
[sortkey]
[case_id]
[estimated_time]
[case_status_id]
[default_tester_id]
[priority_id]
[requirement]
[category_id]
[creation_date]
[summary]
[isautomated]
[arguments]
[alias]
*/
function TestCase_get($case_id) {
	// Create call
	$call = new xmlrpcmsg('TestCase.get', array(new xmlrpcval($case_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
list - Get A List of TestCases Based on A Query

Usage
TestCase.list

Parameters
Parameter	Data Type	Comments
query		hashmap		Can not be null. See Query Examples.

Other attributes available for use with query include: run_id

Result
Array
[0]
  Array
  [author_id]
  [script]
  [sortkey]
  [case_id]
  [estimated_time]
  [case_status_id]
  [default_tester_id]
  [priority_id]
  [requirement]
  [category_id]
  [creation_date]
  [summary]
  [isautomated]
  [arguments]
  [alias]
[1]
  Array
  ...
*/
function TestCase_list($query) {
	// Create array
	foreach($query as $key => $val) {
		switch($key) {
			case "plans":
				unset($va);
				foreach($key as $k => $v) {
					$va[$k] = new xmlrpcval($v, "string");
				}
				$val = $va;
				$type = "struct";
				break;
			case "author_id":
			case "canview":
			case "case_id":
			case "case_status_id":
			case "category_id":
			case "default_tester_id":
			case "isautomated":
			case "priority_id":
			case "sortkey":
				$type = "int";
				break;
			case "alias":
			case "arguments":
			case "creation_date":
			case "requirement":
			case "script":
			case "summary":
			default:
				$type = "string";
		}
		$qarray[$key] = new xmlrpcval($val, $type);
	}

	// Create call
	$call = new xmlrpcmsg('TestCase.list', array(new xmlrpcval($qarray, "struct")));

	// Do call and return value
	return do_call($call);
}

/*
create - Create A New TestCase

Usage
TestCase.create

Parameters
Parameter	Data Type	Comments
new_values	hashmap	See required attributes list below.

Required attributes: author_id, case_status_id, category_id, isautomated, and plan_id.

Result
case_id
*/
function TestCase_create($author_id, $case_status_id, $category_id, $isautomated, $plan_id, $alias = NULL, $arguments = NULL, $canview = NULL, $creation_date = NULL, $default_tester_id = NULL, $priority_id = NULL, $requirement = NULL, $script = NULL, $summary = NULL, $sortkey = NULL) {
	$varray = array("author_id" => "int", "case_status_id" => "int", "category_id" => "int", "isautomated" => "int", "plan_id" => "int", "alias" => "string", "arguments" => "string", "canview" => "int", "creation_date" => "string", "default_tester_id" => "int", "priority_id" => "int", "requirement" => "string", "script" => "string", "summary" => "string", "sortkey" => "int");
	foreach($varray as $key => $val) {
		if (isset(${$key})) {
			$carray[$key] = new xmlrpcval(${$key}, $val);
		}
	}
	// Create call
	$call = new xmlrpcmsg('TestCase.create', array(new xmlrpcval($carray, "struct")));

	// Do call and return value
	return do_call($call);
}

/*
update - Update An Existing TestCase

Usage
TestCase.update

Parameters
Parameter	Data Type	Comments
case_id		integer	
new_values	hashmap	author_id and case_id can not be modified.

Result
Array
[case_id]
[case_status_id]
[default_tester_id]
[plan_id]
[priority_id]
[category_id]
[summary]
[creation_date]
[isautomated]
*/
function TestCase_update($case_id, $case_status_id, $category_id, $isautomated, $alias = NULL, $arguments = NULL, $default_tester_id = NULL, $priority_id = NULL, $requirement = NULL, $script = NULL, $summary = NULL, $sortkey = NULL) {
	$varray = array("case_id" => "int", "case_status_id" => "int", "category_id" => "int", "isautomated" => "int", "alias" => "string", "arguments" => "string", "default_tester_id" => "int", "priority_id" => "int", "requirement" => "string", "script" => "string", "summary" => "string", "sortkey" => "int");
	foreach($varray as $key => $val) {
		if (isset(${$key})) {
			$carray[$key] = new xmlrpcval(${$key}, $val);
		}
	}
	// Create call
	$call = new xmlrpcmsg('TestCase.update', array(new xmlrpcval($carray, "struct")));

	// Do call and return value
	return do_call($call);
}

/*
get_text - Get TestCase's Current Action/Effect Document

Usage
TestCase.get_text

Parameters
Parameter	Data Type
case_id		integer	

Result
Array
[author_id]
[breakdown]
[setup]
[version]
[effect]
[action]
*/
function TestCase_get_text($case_id) {
	// Create call
	$call = new xmlrpcmsg('TestCase.get_text', array(new xmlrpcval($case_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
store_text - Add A New TestCase Action/Effect Document

Usage
TestCase.store_text

Parameters
Parameter	Data Type
case_id		integer
author_id	integer
action		string
effect		string
setup		string
breakdown	string

Result
version
*/
function TestCase_store_text($case_id, $author_id = NULL, $action = NULL, $effect = NULL, $setup = NULL, $breakdown = NULL) {
	// Create call
	$call = new xmlrpcmsg('TestCase.store_text', array(new xmlrpcval($case_id, "int"), new xmlrpcval($author_id, "int"), new xmlrpcval($action, "string"), new xmlrpcval($effect, "string"), new xmlrpcval($setup, "string"), new xmlrpcval($breakdown, "string")));

	// Do call and return value
	return do_call($call);
}

/*
get_bugs - Get a list of bugs for the given TestCase

Usage
TestCase.get_bugs

Parameters
Parameter	Data Type	Comments
case_id		integer

Result
Array
[0]
  Array
  [priority]
  [cf_nts_priority]
  [bug_id]
  [qa_contact_id]
  [cclist_accessible]
  [cf_foundby]
  [infoprovider_id]
  [short_desc]
  [everconfirmed]
  [bug_severity]
  [isunconfirmed]
  [cf_nts_support_num]
  [reporter_id]
  [estimated_time]
  [isopened]
  [remaining_time]
  [cf_partnerid]
  [reporter_accessible]
  [resolution]
  [alias]
  [op_sys]
  [bug_file_loc]
  [product_id]
  [rep_platform]
  [creation_ts]
  [status_whiteboard]
  [bug_status]
  [delta_ts]
  [version]
  [deadline]
  [component_id]
  [assigned_to_id]
  [target_milestone]
[1]
  Array
  ...
*/
function TestCase_get_bugs($case_id) {
	// Create call
	$call = new xmlrpcmsg('TestCase.get_bugs', array(new xmlrpcval($case_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
add_component - Add a component to the given TestCase

Usage
TestCase.add_component

Parameters
Parameter	Data Type	Comments
case_id		integer
component_id	integer

Result
0
*/
function TestCase_add_component($case_id, $component_id) {
	// Create call
	$call = new xmlrpcmsg('TestCase.add_component', array(new xmlrpcval($case_id, "int"), new xmlrpcval($component_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
remove_component - Remove a component from the given TestCase

Usage
TestCase.remove_component

Parameters
Parameter	Data Type	Comments
case_id		integer
component_id	integer

Result
O
*/
function TestCase_remove_component($case_id, $component_id) {
	// Create call
	$call = new xmlrpcmsg('TestCase.remove_component', array(new xmlrpcval($case_id, "int"), new xmlrpcval($component_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
get_components - Get a list of components for the given TestCase

Usage
TestCase.get_components

Parameters
Parameter	Data Type	Comments
case_id		integer	

Result
[0]
  Array
  [disallownew]
  [name]
  [description]
  [initialqacontact]
  [initialowner]
  [product_id]
  [id]
  [product_name]
[1]
  Array
  ...
*/
function TestCase_get_components($case_id) {
	// Create call
	$call = new xmlrpcmsg('TestCase.get_components', array(new xmlrpcval($case_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
add_tag - Add a tag to the given TestCase

Usage
TestCase.add_tag

Parameters
Parameter	Data Type	Comments
case_id		integer	
tag_name	string	Creates tag if it does not exist

Result
0
*/
function TestCase_add_tag($case_id, $tag_name) {
	// Create call
	$call = new xmlrpcmsg('TestCase.add_tag', array(new xmlrpcval($case_id, "int"), new xmlrpcval($tag_name, "string")));

	// Do call and return value
	return do_call($call);
}

/*
remove_tag - Remove a tag from the given TestCase

Usage
TestCase.remove_tag

Parameters
Parameter	Data Type	Comments
case_id		integer	
tag_name	string	

Result
0
*/
function TestCase_remove_tag($case_id, $tag_name) {
	// Create call
	$call = new xmlrpcmsg('TestCase.remove_tag', array(new xmlrpcval($case_id, "int"), new xmlrpcval($tag_name, "string")));

	// Do call and return value
	return do_call($call);
}

/*
get_tags - Get a list of tags for the given TestCase

Usage
TestCase.get_tags

Parameters
Parameter	Data Type	Comments
case_id	integer	

Result
[0]
  Array
  [plan_count]
  [tag_name]
  [case_count]
  [run_count]
  [tag_id]
[1]
  Array
  ...
*/
function TestCase_get_tags($case_id) {
	// Create call
	$call = new xmlrpcmsg('TestCase.get_tags', array(new xmlrpcval($case_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
get_plans - Get a list of TestPlans for the given TestCase

Usage
TestCase.get_plans

Parameters
Parameter	Data Type	Comments
case_id	integer	

Result
[0]
  Array
  [author_id]
  [name]
  [default_product_version]
  [plan_id]
  [product_id]
  [creation_date]
  [type_id]
  [isactive]
[1]
  Array
  ...
*/
function TestCase_get_plans($case_id) {
	// Create call
	$call = new xmlrpcmsg('TestCase.get_plans', array(new xmlrpcval($case_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
lookup_category_id_by_name - Lookup A TestCase Category ID By Its Name

Usage
TestCase.lookup_category_id_by_name

Parameters
Parameter	Data Type	Comments
name		string	Cannot be null or empty string

Result
category_id
*/
function TestCase_lookup_category_id_by_name($name) {
	// Create call
	$call = new xmlrpcmsg('TestCase.lookup_category_id_by_name', array(new xmlrpcval($name, "string")));

	// Do call and return value
	return do_call($call);
}

/*
lookup_category_name_by_id - Lookup A TestCase Category Name By Its ID

Usage
TestCase.lookup_category_name_by_id

Parameters
Parameter	Data Type	Comments
category_id	integer	Cannot be 0

Result
name
*/
function TestCase_lookup_category_name_by_id($category_id) {
	// Create call
	$call = new xmlrpcmsg('TestCase.lookup_category_name_by_id', array(new xmlrpcval($category_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
lookup_priority_id_by_name - Lookup A TestCase Priority ID By Its Name

Usage
TestCase.lookup_priority_id_by_name

Parameters
Parameter	Data Type	Comments
name		string		Cannot be null or empty string

Result
priority_id
*/
function TestCase_lookup_priority_id_by_name($name) {
	// Create call
	$call = new xmlrpcmsg('TestCase.lookup_priority_id_by_name', array(new xmlrpcval($name, "string")));

	// Do call and return value
	return do_call($call);
}

/*
lookup_priority_name_by_id - Lookup A TestCase Priority Name By Its ID

Usage
TestCase.lookup_priority_name_by_id

Parameters
Parameter	Data Type	Comments
priority_id	integer		Cannot be 0

Result
name
*/
function TestCase_lookup_priority_name_by_id($priority_id) {
	// Create call
	$call = new xmlrpcmsg('TestCase.lookup_priority_name_by_id', array(new xmlrpcval($priority_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
lookup_status_id_by_name - Lookup A TestCase Status ID By Its Name

Usage
TestCase.lookup_status_id_by_name

Parameters
Parameter	Data Type	Comments
name		string		Cannot be null or empty string

Result
status_id
*/
function TestCase_lookup_status_id_by_name($name) {
	// Create call
	$call = new xmlrpcmsg('TestCase.lookup_status_id_by_name', array(new xmlrpcval($name, "string")));

	// Do call and return value
	return do_call($call);
}

/*
lookup_status_name_by_id - Lookup A TestCase Status Name By Its ID

Usage
TestCase.lookup_status_name_by_id

Parameters
Parameter	Data Type	Comments
status_id	integer		Cannot be 0

Result
name
*/
function TestCase_lookup_status_name_by_id($status_id) {
	// Create call
	$call = new xmlrpcmsg('TestCase.lookup_status_name_by_id', array(new xmlrpcval($status_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
link_plan - Link A TestPlan To An Existing TestCase

Usage
TestCase.link_plan

Parameters
Parameter	Data Type
case_id		integer	
plan_id		integer

Result
Array
[0]
  Array
  [author_id]
  [name]
  [default_product_version]
  [plan_id]
  [product_id]
  [creation_date]
  [type_id]
  [isactive]
[1]
  Array
  ...
*/
function TestCase_link_plan($case_id, $plan_id) {
	// Create call
	$call = new xmlrpcmsg('TestCase.link_plan', array(new xmlrpcval($case_id, "int"), new xmlrpcval($plan_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
unlink_plan - Unlink A TestPlan From An Existing TestCase

Usage
TestCase.unlink_plan

Parameters
Parameter	Data Type
case_id		integer
plan_id		integer

Result
Array
[0]
  Array
  [author_id]
  [name]
  [default_product_version]
  [plan_id]
  [product_id]
  [creation_date]
  [type_id]
  [isactive]
[1]
  Array
  ...
*/
function TestCase_unlink_plan($case_id, $plan_id) {
	// Create call
	$call = new xmlrpcmsg('TestCase.unlink_plan', array(new xmlrpcval($case_id, "int"), new xmlrpcval($plan_id, "int")));

	// Do call and return value
	return do_call($call);
}


/*
 * * * TestRun * * *

Attributes
Attribute		Data Type		Comments
build_id		integer
environment_id		integer	
manager_id		integer	
notes			string	
plan			TestPlan hashmap	Read Only
plan_id			integer	
plan_text_version	integer	
product_version		integer	
run_id			integer	
start_date		string			Format: yyyy-mm-dd hh:mm:ss
stop_date		string			Format: yyyy-mm-dd hh:mm:ss
summary			string
*/

/*
get - Get A TestRun by ID

Usage
TestRun.get

Parameters
Parameter	Data Type	Comments
run_id		integer		Must be greater than 0.

Result
Array
[build_id]
[plan_text_version]
[manager_id]
[stop_date]
[run_id]
[plan_id]
[product_version]
[environment_id]
[summary]
[notes]
[start_date]
*/
function TestRun_get($run_id) {
	// Create call
	$call = new xmlrpcmsg('TestRun.get', array(new xmlrpcval($run_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
list - Get A List of TestRuns Based on A Query

Usage
TestRun.list

Parameters
Parameter	Data Type	Comments
query		hashmap		Can not be null. See Query Examples.

Result
Array
[0]
  Array
  [build_id]
  [plan_text_version]
  [manager_id]
  [stop_date]
  [run_id]
  [plan_id]
  [product_version]
  [environment_id]
  [summary]
  [notes]
  [start_date]
[1]
  Array
  ...
*/
function TestRun_list($query) {
	// Create array
	foreach($query as $key => $val) {
		switch($key) {
			case "plan":
				unset($va);
				foreach($key as $k => $v) {
					$va[$k] = new xmlrpcval($v, "string");
				}
				$val = $va;
				$type = "struct";
				break;
			case "build_id":
			case "environment_id":
			case "manager_id":
			case "plan_id":
			case "plan_text_version":
			case "product_version":
			case "run_id":
				$type = "int";
				break;
			case "notes":
			case "start_date":
			case "stop_date":
			case "summary":
			default:
				$type = "string";
		}
		$qarray[$key] = new xmlrpcval($val, $type);
	}

	// Create call
	$call = new xmlrpcmsg('TestRun.list', array(new xmlrpcval($qarray, "struct")));

	// Do call and return value
	return do_call($call);
}

/*
create - Create A New TestRun

Usage
TestRun.create

Parameters
Parameter	Data Type	Comments
new_values	hashmap		See required attributes list below.

Required attributes: build_id, environment, manager, plan_id, plan_text_version, and summary.

Result
run_id
*/
function TestRun_create($build_id, $environment_id, $manager_id, $plan_id, $plan_text_version, $summary, $notes = NULL, $start_date = NULL, $stop_date = NULL) {
	$varray = array("build_id" => "int", "environment_id" => "int", "manager_id" => "int", "plan_id" => "int", "plan_text_version" => "int", "summary" => "string", "notes" => "string", "start_date" => "string", "stop_date" => "string");
	foreach($varray as $key => $val) {
		if (isset(${$key})) {
			$carray[$key] = new xmlrpcval(${$key}, $val);
		}
	}
	// Create call
	$call = new xmlrpcmsg('TestRun.create', array(new xmlrpcval($carray, "struct")));

	// Do call and return value
	return do_call($call);
}

/*
update - Update An Existing TestRun

Usage
TestRun.update

Parameters
Parameter	Data Type	Comments
run_id		integer
new_values	hashmap		plan_id can not be modified.

Result
Array
[build_id]
[environment_id]
[manager_id]
[plan_text_version]
[summary]
[notes]
[start_date]
[stop_date]
[run_id]
*/
function TestRun_update($run_id, $build_id, $environment_id, $manager_id, $plan_text_version, $summary, $notes = NULL, $start_date = NULL, $stop_date = NULL) {
	$varray = array("build_id" => "int", "environment_id" => "int", "manager_id" => "int", "plan_text_version" => "int", "summary" => "string", "notes" => "string", "start_date" => "string", "stop_date" => "string");
	foreach($varray as $key => $val) {
		if (isset(${$key})) {
			$carray[$key] = new xmlrpcval(${$key}, $val);
		}
	}
	// Create call
	$call = new xmlrpcmsg('TestRun.update', array(new xmlrpcval($run_id, "int"), new xmlrpcval($carray, "struct")));

	// Do call and return value
	return do_call($call);
}

/*
get_test_cases - Get A List of TestCases For An Existing Test Run

Usage
TestRun.get_test_cases

Parameters
Parameter	Data Type
run_id		integer	

Result
? FIXME
*/
function TestRun_get_test_cases($run_id) {
	// Create call
	// FIXME: not working
	$call = new xmlrpcmsg('TestRun.get_test_cases', array(new xmlrpcval($run_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
get_test_case_runs - Get A List of TestCase Runs For An Existing Test Run

Usage
TestRun.get_test_case_runs

Parameters
Parameter	Data Type
run_id		integer

Result
Array
[0]
  Array
  [build_id]
  [case_text_version]
  [running_date]
  [sortkey]
  [case_id]
  [run_id]
  [testedby]
  [assignee]
  [environment_id]
  [close_date]
  [notes]
  [case_run_id]
  [iscurrent]
  [case_run_status_id]
[1]
  Array
  ...
*/
function TestRun_get_test_case_runs($run_id) {
	// Create call
	$call = new xmlrpcmsg('TestRun.get_test_case_runs', array(new xmlrpcval($run_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
get_test_plan - Get A TestPlan For An Existing Test Run

Usage
TestRun.get_test_plan

Parameters
Parameter	Data Type
run_id		integer	

Result
Array
[author_id]
[name]
[default_product_version]
[plan_id]
[product_id]
[creation_date]
[type_id]
[isactive]
*/
function TestRun_get_test_plan($run_id) {
	// Create call
	$call = new xmlrpcmsg('TestRun.get_test_plan', array(new xmlrpcval($run_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
add_tag - Add a tag to the given TestRun

Usage
TestRun.add_tag

Parameters
Parameter	Data Type	Comments
run_id		integer
tag_name	string		Creates tag if it does not exist

Result
0
*/
function TestRun_add_tag($run_id, $tag_name) {
	// Create call
	$call = new xmlrpcmsg('TestRun.add_tag', array(new xmlrpcval($run_id, "int"), new xmlrpcval($tag_name, "string")));

	// Do call and return value
	return do_call($call);
}

/*
remove_tag - Remove a tag from the given TestRun

Usage
TestRun.remove_tag

Parameters
Parameter	Data Type
run_id		integer	
tag_name	string

Result
0
*/
function TestRun_remove_tag($run_id, $tag_name) {
	// Create call
	$call = new xmlrpcmsg('TestRun.remove_tag', array(new xmlrpcval($run_id, "int"), new xmlrpcval($tag_name, "string")));

	// Do call and return value
	return do_call($call);
}

/*
get_tags - Get a list of tags for the given TestRun

Usage
TestRun.get_tags

Parameters
Parameter	Data Type
run_id		integer

Result
Array
[0]
  Array
  [plan_count]
  [tag_name]
  [case_count]
  [run_count]
  [tag_id]
[0]
  Array
  ...
*/
function TestRun_get_tags($run_id) {
	// Create call
	$call = new xmlrpcmsg('TestRun.get_tags', array(new xmlrpcval($run_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
lookup_environment_id_by_name - Lookup A TestRun Environment ID By Its Name

Usage
TestRun.lookup_environment_id_by_name

Parameters
Parameter	Data Type	Comments
name		string		Cannot be null or empty string

Result
environment_id
*/
function TestRun_lookup_environment_id_by_name($name) {
	// Create call
	$call = new xmlrpcmsg('TestRun.lookup_environment_id_by_name', array(new xmlrpcval($name, "string")));

	// Do call and return value
	return do_call($call);
}

/*
lookup_environment_name_by_id - Lookup A TestRun Environment Name By Its ID

Usage
TestRun.lookup_environment_name_by_id

Parameters
Parameter	Data Type	Comments
environment_id	integer		Cannot be 0

Result
name
*/
function TestRun_lookup_environment_name_by_id($environment_id) {
	// Create call
	$call = new xmlrpcmsg('TestRun.lookup_environment_name_by_id', array(new xmlrpcval($environment_id, "int")));

	// Do call and return value
	return do_call($call);
}


/*
 * * * TestCaseRun * * *

Attributes
Attribute		Data Type	Comments
assigneed		integer		ID value (= assigneed_id)
build_id		integer
canview			integer		Read Only
case_id			integer		Read Only
case_run_id		integer		Read Only
case_run_status_id	integer
case_text_version	integer		Read Only
close_date		string		Read Only (Format: yyyy-mm-dd hh:mm:ss)
environment_id		integer
iscurrent		integer		Read Only
notes			string
run_id			integer		Read Only
sortkey			integer		Read Only
testedby		integer		Read Only (ID value)
*/

/*
get - Get A TestCaseRun by ID

Usage
TestCaseRun.get

Parameters
Parameter	Data Type	Comments
case_run_id	integer		Must be greater than 0.

Result
Array
[build_id]
[case_text_version]
[running_date]
[sortkey]
[case_id]
[run_id]
[testedby]
[assignee]
[environment_id]
[close_date]
[notes]
[case_run_id]
[iscurrent]
[case_run_status_id]
*/
function TestCaseRun_get($case_run_id) {
	// Create call
	$call = new xmlrpcmsg('TestCaseRun.get', array(new xmlrpcval($case_run_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
list - Get A List of TestCaseRuns Based on A Query

Usage
TestCaseRun.list

Parameters
Parameter	Data Type	Comments
query		hashmap		Can not be null. See Query Examples.

Result
Array
[0]
  Array
  [build_id]
  [case_text_version]
  [running_date]
  [sortkey]
  [case_id]
  [run_id]
  [testedby]
  [assignee]
  [environment_id]
  [close_date]
  [notes]
  [case_run_id]
  [iscurrent]
  [case_run_status_id]
[1]
  Array
  ...
*/
function TestCaseRun_list($query) {
	// Create array
	foreach($query as $key => $val) {
		switch($key) {
			case "assignee":
			case "build_id":
			case "canview":
			case "case_id":
			case "case_run_id":
			case "case_run_status_id":
			case "case_text_version":
			case "environment_id":
			case "iscurrent":
			case "run_id":
			case "sortkey":
			case "testedby":
				$type = "int";
				break;
			case "close_date":
			case "notes":
			default:
				$type = "string";
		}
		$qarray[$key] = new xmlrpcval($val, $type);
	}

	// Create call
	$call = new xmlrpcmsg('TestCaseRun.list', array(new xmlrpcval($qarray, "struct")));

	// Do call and return value
	return do_call($call);
}


/*
create - Create A New TestCaseRun

Usage
TestCaseRun.create

Parameters
Parameter	Data Type	Comments
new_values	hashmap		See required attributes list below.

Required attributes: assignee, build_id, case_id, case_text_version, environment_id, and run_id
case_run_status_id always set to 1 (IDLE) on create

Result
case_run_id
*/
function TestCaseRun_create($assignee, $build_id, $case_id, $case_text_version, $environment_id, $run_id, $canview = NULL, $close_date = NULL, $iscurrent = NULL, $notes = NULL, $sortkey = NULL, $testedby = NULL) {
	$varray = array("assignee" => "int", "build_id" => "int", "case_id" => "int", "case_text_version" => "int", "environment_id" => "int", "run_id" => "int", "canview" => "int", "close_date" => "string", "iscurrent" => "int", "notes" => "string", "sortkey" => "int", "testedby" => "int");
	foreach($varray as $key => $val) {
		if (isset(${$key})) {
			$carray[$key] = new xmlrpcval(${$key}, $val);
		}
	}
	// Create call
	$call = new xmlrpcmsg('TestCaseRun.create', array(new xmlrpcval($carray, "struct")));

	// Do call and return value
	return do_call($call);
}

/*
update - Update An Existing TestCaseRun

Usage
TestCaseRun.update

Parameters
Parameter	Data Type	Comments
run_id		integer
case_id		integer
build_id	integer
environment_id	integer
new_values	hashmap		See attributes list modifiable fields.

The notes attribute can be used to append a new note to the respective TestCaseRun.
To automatically update an attached bug's status, set the new_values attribute, update_bugs, to 1.

Result
Array
[case_text_version]
[status] 
[assignee]
[environment_id]
[close_date]
[case_run_id]
[iscurrent]
[case_run_status_id]
[build_id]
[sortkey]
[running_date]
[case_id]
[run_id]
[testedby]
[notes]
*/
function TestCaseRun_update($run_id, $case_id, $build_id, $environment_id, $assignee = NULL, $case_run_status_id = NULL, $notes = NULL, $update_bugs = NULL) {
	$varray = array("assignee" => "int", "case_run_status_id" => "int", "notes" => "string", "update_bugs" => "int");
	foreach($varray as $key => $val) {
		if (isset(${$key})) {
			$carray[$key] = new xmlrpcval(${$key}, $val);
		}
	}
	// Create call
	$call = new xmlrpcmsg('TestCaseRun.update', array(new xmlrpcval($run_id, "int"),new xmlrpcval($case_id, "int"),new xmlrpcval($build_id, "int"),new xmlrpcval($environment_id, "int"), new xmlrpcval($carray, "struct")));

	// Do call and return value
	return do_call($call);
}

/*
get_bugs - Get a list of bugs for the given TestCaseRun

Usage
TestCaseRun.get_bugs

Parameters
Parameter	Data Type
case_run_id	integer

Result
Array
[0]
  Array
  [priority]
  [cf_nts_priority] 
  [bug_id]
  [qa_contact_id]
  [cclist_accessible]
  [cf_foundby]
  [infoprovider_id]
  [short_desc]
  [everconfirmed]
  [bug_severity]
  [isunconfirmed]
  [cf_nts_support_num]
  [reporter_id]
  [estimated_time]
  [isopened]
  [remaining_time]
  [cf_partnerid]
  [reporter_accessible]
  [resolution]
  [alias]
  [op_sys]
  [bug_file_loc]
  [product_id]
  [rep_platform]
  [creation_ts]
  [status_whiteboard]
  [bug_status]
  [delta_ts]
  [version]
  [deadline]
  [component_id]
  [assigned_to_id]
  [target_milestone]
[1]
  Array
  ...
*/
function TestCaseRun_get_bugs($case_run_id) {
	// Create call
	$call = new xmlrpcmsg('TestCaseRun.get_bugs', array(new xmlrpcval($case_run_id, "int")));

	// Do call and return value
	return do_call($call);
}

/*
lookup_status_id_by_name - Lookup A TestCaseRun Status ID By Its Name

Usage
TestCaseRun.lookup_status_id_by_name

Parameters
Parameter	Data Type	Comments
name		string		Cannot be null or empty string

Result
case_run_status_id
*/
function TestCaseRun_lookup_status_id_by_name($name) {
	// Create call
	$call = new xmlrpcmsg('TestCaseRun.lookup_status_id_by_name', array(new xmlrpcval($name, "string")));

	// Do call and return value
	return do_call($call);
}

/*
lookup_status_name_by_id - Lookup A TestCaseRun Status Name By Its ID

Usage
TestCaseRun.lookup_status_name_by_id

Parameters
Parameter	Data Type	Comments
case_run_status_id	integer		Cannot be 0

Result
name
*/
function TestCaseRun_lookup_status_name_by_id($case_run_status_id) {
	// Create call
	$call = new xmlrpcmsg('TestCaseRun.lookup_status_name_by_id', array(new xmlrpcval($case_run_status_id, "int")));

	// Do call and return value
	return do_call($call);
}
?>
