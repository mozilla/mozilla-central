var testcase;
var filter_req;

var showAllTests = function(err) {
  // if they cancelled, then just don't change anything:
  if (err instanceof CancelledError) { return }
    toggleMessage('none');

  var testbox = document.getElementById("testcase_id");
  for (var i=0; i<testbox.options.length; i++) {
    var option = testbox.options[i];
    option.style.display = '';
  }
  enableForm(formName);
};

function splitIt(it) {
  return it.split("\n");
}

var doFilterList = function(req) {
  var tests = splitIt(req.responseText);
  var testbox = document.getElementById("testcase_id");
  var l = testbox.options.length;
  var hideTest;
  for (var i=0; i<l; i++) {
    var test = testbox.options[i];
    if (tests.indexOf(test.value) == -1) { hideTest = 1; }
    else { hideTest=0 } 
    hideTest == 1 ? test.style.display = 'none' : test.style.display = '';
  }
  enableForm(formName);
  toggleMessage('none');
};

// filter the list by various criteria:
function filterList() {
  // they just changed the selection, so cancel any pending filter actions:
  if (filter_req instanceof Deferred && filter_req.fired == -1)
  filter_req.cancel();

  disableForm(formName);

  var productfilter = document.getElementById('product_filter');
  var branchfilter = document.getElementById('branch_filter');
  var testgroupfilter = document.getElementById('testgroup_filter');
  var subgroupfilter = document.getElementById('subgroup_filter');

  if (productfilter.options[productfilter.selectedIndex].value == '' &&
      branchfilter.options[branchfilter.selectedIndex].value == '' &&
      testgroupfilter.options[testgroupfilter.selectedIndex].value == '' &&
      subgroupfilter.options[subgroupfilter.selectedIndex].value == '') {
    // nothing to do here
    showAllTests();
    return;
  }

  toggleMessage('loading','Filtering testcase list...');
  filter_req = doSimpleXMLHttpRequest('manage_testcases.cgi', {
    searchTestcaseList: 1,
    product: (productfilter.options[productfilter.selectedIndex].value == '' ?
      '' : productfilter.options[productfilter.selectedIndex].value),
    branch: (branchfilter.options[branchfilter.selectedIndex].value == '' ?
      '' : branchfilter.options[branchfilter.selectedIndex].value),
    testgroup: (testgroupfilter.options[testgroupfilter.selectedIndex].value == '' ? 
      '' : testgroupfilter.options[testgroupfilter.selectedIndex].value),
    subgroup: (subgroupfilter.options[subgroupfilter.selectedIndex].value == '' ? 
      '' : subgroupfilter.options[subgroupfilter.selectedIndex].value),
  });
  // if something went wrong, just show all the tests:
  filter_req.addErrback(showAllTests);
  filter_req.addCallback(doFilterList);
}

function setAuthor(user_id) {
  var authorBox = document.getElementById('author_id');
  setSelected(authorBox,user_id);;
}

function enableModeButtons() {
  document.getElementById("edit_testcase_button").disabled=false;
  document.getElementById("clone_testcase_button").disabled=false;
  document.getElementById("delete_testcase_button").disabled=false;
}

function disableModeButtons() {
  document.getElementById("edit_testcase_button").disabled=true;
  document.getElementById("clone_testcase_button").disabled=true;
  document.getElementById("delete_testcase_button").disabled=true;
}

function loadTestcase(silent) {
  var testcase_select = document.getElementById("testcase_id");

  if (! testcase_select ||
      testcase_select.options[testcase_select.selectedIndex].value=="") {
    disableModeButtons();
    document.getElementById('testcase_display_div').style.display = 'none';
    document.getElementById('editform_div').style.display = 'none';
    disableForm('edit_testcase_form');
    blankTestcaseForm('edit_testcase_form');
    return false;
  } 

  var testcase_id = testcase_select.options[testcase_select.selectedIndex].value;

  disableForm('edit_testcase_form');
  if (!silent) {
    toggleMessage('loading','Loading Testcase ID# ' + testcase_id + '...');
  }
  var url = 'json.cgi?testcase_id=' + testcase_id;
  fetchJSON(url,populateTestcase,silent);
}

function populateTestcase(data) {
  testcase=data;
  document.getElementById('editform_testcase_id').value = testcase.testcase_id;
  document.getElementById('testcase_id_display').innerHTML = testcase.testcase_id;
  document.getElementById('summary').value = testcase.summary;
  document.getElementById('steps').value = testcase.steps;
  document.getElementById('results').value = testcase.expected_results;

  document.getElementById('summary_text').innerHTML = testcase.summary;
  document.getElementById('steps_text').innerHTML = testcase.steps_formatted;
  document.getElementById('results_text').innerHTML = testcase.expected_results_formatted;

  var productBox = document.getElementById('product');
  loadProducts(productBox,'',1);
  var found_product = setSelected(productBox,testcase.product_id.product_id);
  if (found_product == 1) {
    for (var i=0; i<products.length; i++) {
      if (products[i].product_id == testcase.product_id.product_id) {
        document.getElementById('product_text').innerHTML = products[i].name;
        continue;
      }
    }
  } else {
    document.getElementById('product_text').innerHTML = '<em>No product set for this testcase.</em>';
  }

  changeProduct();
  var branchBox = document.getElementById('branch');
  populateBranches(branchBox,productBox);
  var found_branch = setSelected(branchBox,testcase.branch_id.branch_id);
  if (found_branch == 1) {
    for (var i=0; i<branches.length; i++) {
      if (branches[i].branch_id == testcase.branch_id.branch_id) {
        document.getElementById('branch_text').innerHTML = branches[i].name;
        continue;
      }
    }
  } else {
    document.getElementById('branch_text').innerHTML = '<em>No branch set for this subgroup.</em>';
  }

  var testgroups_text = "";
  var testgroups_link_text = "";
  for (var i in testcase.testgroups) {
    if (testcase.testgroups[i].name != '') {
      testgroups_text = testgroups_text + testcase.testgroups[i].name + ', ';
      testgroups_link_text = testgroups_link_text + '<a target="manage_testgroups" href="manage_testgroups.cgi?testgroup_id=' + testcase.testgroups[i].testgroup_id + '">'+ testcase.testgroups[i].name + '</a>, ';

    }
  }
  if (testgroups_text != '') {
    testgroups_text = testgroups_text.replace(/, $/g,'');
    testgroups_link_text = testgroups_link_text.replace(/, $/g,'');
    document.getElementById('testgroups_display').innerHTML = testgroups_text;
    document.getElementById('testgroups_link_display').innerHTML = testgroups_link_text;
  } else {
    document.getElementById('testgroups_display').innerHTML = '<span class="errorHeading">This testcase does not belong to any testgroups that are currently enabled.</span>';
    document.getElementById('testgroups_link_display').innerHTML = '<span class="errorHeading">This testcase does not belong to any testgroups that are currently enabled &rArr;&nbsp;<a target="manage_testgroups" href="manage_testgroups.cgi">Jump to Manage Testgroups</a>.</span>';
  }

  var subgroups_text = "";
  var subgroups_link_text = "";
  for (var i in testcase.subgroups) {
    if (testcase.subgroups[i].name != '') {
      subgroups_text = subgroups_text + testcase.subgroups[i].name + ', ';
      subgroups_link_text = subgroups_link_text + '<a target="manage_subgroups" href="manage_subgroups.cgi?subgroup_id=' + testcase.subgroups[i].subgroup_id + '">'+ testcase.subgroups[i].name + '</a>, ';
    }
  }
  if (subgroups_text != '') {
    subgroups_text = subgroups_text.replace(/, $/g,'');
    subgroups_link_text = subgroups_link_text.replace(/, $/g,'');
    document.getElementById('subgroups_display').innerHTML = subgroups_text;
    document.getElementById('subgroups_link_display').innerHTML = subgroups_link_text;
  } else {
    document.getElementById('subgroups_display').innerHTML = '<span class="errorHeading">This testcase does not belong to any subgroups that are currently enabled.</span>';
    document.getElementById('subgroups_link_display').innerHTML = '<span class="errorHeading">This testcase does not belong to any subgroups that are currently enabled &rArr;&nbsp;<a target="manage_subgroups" href="manage_subgroups.cgi">Jump to Manage Subgroups</a>.</span>';
  }

  var enabled_em = document.getElementById('enabled')
  var enabled_display_em = document.getElementById('enabled_display')
  if (testcase.enabled == 1) {
    enabled_em.checked = true;
    enabled_display_em.checked = true;
  } else {
    enabled_em.checked = false;
    enabled_display_em.checked = false;
  } 
  var communityenabled_em = document.getElementById('communityenabled')
  var communityenabled_display_em = document.getElementById('community_enabled_display')
  if (testcase.community_enabled == 1) {
    communityenabled_em.checked = true;
    communityenabled_display_em.checked = true;
  } else {
    communityenabled_em.checked = false;
    communityenabled_display_em.checked = false;
  }
  if (testcase.regression_bug_id) {
    document.getElementById('regression_bug_id_display').innerHTML = '<a href="' + generateBugLink(testcase.regression_bug_id) + '">' + testcase.regression_bug_id + '</a>';
    document.getElementById('regression_bug_id').value = testcase.regression_bug_id;
  } else {
    document.getElementById('regression_bug_id_display').innerHTML = 'None specified';
    document.getElementById('regression_bug_id').value = "";
  }
  setAuthor(testcase.author_id.user_id);
  document.getElementById('creation_date').innerHTML = testcase.creation_date;
  document.getElementById('last_updated').innerHTML = testcase.last_updated;
  document.getElementById('litmus_version').innerHTML = testcase.version;
  document.getElementById('testrunner_case_id').innerHTML = testcase.testrunner_case_id;
  document.getElementById('testrunner_case_version').innerHTML = testcase.testrunner_case_version;

  document.getElementById('editform_div').style.display = 'none';
  document.getElementById('testcase_display_div').style.display = 'block';
  enableModeButtons();

  if (firstPassEdit) {
    firstPassEdit = 0;
    switchToEdit();
  }
}

function blankTestcaseForm(formid) {
  blankForm(formid);
  document.getElementById('testcase_id_display').innerHTML = '';
  document.getElementById('creation_date').innerHTML = '';
  document.getElementById('last_updated').innerHTML = '';
  document.getElementById('litmus_version').innerHTML = '';
  document.getElementById('testrunner_case_id').innerHTML = '';
  document.getElementById('testrunner_case_version').innerHTML = '';
  changeProduct();
}

function switchToAdd() {
  disableModeButtons();
  blankTestcaseForm('edit_testcase_form');
  var productBox = document.getElementById('product');
  loadProducts(productBox,'',1);
  changeProduct();
  setAuthor(current_user_id);
  document.getElementById('submit').value = 'Add Testcase';
  document.getElementById('mode').value = 'add';
  enableForm('edit_testcase_form');
  document.getElementById('testcase_display_div').style.display = 'none';
  document.getElementById('testcase_id_display').innerHTML = '<em>Automatically generated for a new testcase</em>';
  document.getElementById('testgroups_link_display').innerHTML = '<em>A new testcase does not belong to any testgroups by default.<br/>Use the <a target="manage_testgroups" href="manage_testgroups.cgi">Manage Testgroups</a> interface to assign the subgroups to testgroups after the new testcase is created.</em>';
  document.getElementById('subgroups_link_display').innerHTML = '<em>A new testcase does not belong to any subgroups by default.<br/>Use the <a target="manage_subgroups" href="manage_subgroups.cgi">Manage Subgroups</a> interface to assign the new testcase to subgroups once it is created.</em>';
  document.getElementById('creation_date').innerHTML = '<em>Automatically generated for a new testcase</em>';
  document.getElementById('last_updated').innerHTML = '<em>Automatically generated for a new testcase</em>';
  document.getElementById('litmus_version').innerHTML = '<em>Automatically generated for a new testcase</em>';
  document.getElementById('testrunner_case_id').innerHTML = '<em>Not Applicable</em>';
  document.getElementById('testrunner_case_version').innerHTML = '<em>Not Applicable</em>';
  document.getElementById('editform_div').style.display = 'block';
}

function switchToEdit() {
  document.getElementById('submit').value = 'Submit Edits';
  document.getElementById('mode').value = 'edit';
  enableForm('edit_testcase_form');
  document.getElementById('testcase_display_div').style.display = 'none';
  document.getElementById('editform_div').style.display = 'block';
}

function resetTestcase() {
  if (document.getElementById('testcase_id').value != '') {
    populateTestcase(testcase);
    switchToEdit();   
  } else {
    switchToAdd();
  }
}

function checkFormContents(f) {
  return (
          checkString(f.summary, 'Summary') &&
          verifySelected(f.product, 'Product') &&
          verifySelected(f.branch, 'Branch') &&
          verifySelected(f.author_id, 'Author')
         );
}

function generateBugLink(bugID) {
  return 'https://bugzilla.mozilla.org?show_bug.cgi?id=' + bugID;
}

