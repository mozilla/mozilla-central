var testcase;
var filter_req;
var initial_load = 1;

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
  var alreadySeen = new Object;
  for (var i=0; i<l; i++) {
    var test = testbox.options[i];
    var hide = 0;
    var id = test.value;
    if (alreadySeen[id]) {
      hide = 1;
    } else {
      alreadySeen[id] = 1;
      if (tests.indexOf(test.value) == -1) {
        hide = 1;
      }
    }
    hide == 1 ? test.style.display = 'none' : test.style.display = '';
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
      '' : subgroupfilter.options[subgroupfilter.selectedIndex].value)
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
  return fetchJSON(url,populateTestcase,silent);
}

function populateTestcase(data) {
  testcase=data;
  document.getElementById('editform_testcase_id').value = testcase.testcase_id;
  document.getElementById('testcase_id_display').innerHTML = testcase.testcase_id;
  document.getElementById('testcase_id_display_edit').innerHTML = testcase.testcase_id;
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

  var testgroups_display_text = "";
  var testgroups_div = document.getElementById('testgroups_display');
  var subgroups_display_text = "";
  var subgroups_div = document.getElementById('subgroups_display');

  if (testcase.testgroups && testcase.testgroups.length > 0) {
    for (var i=0; i<testcase.testgroups.length; i++) {
      testgroups_display_text += '<a target="manage_testgroups" href="manage_testgroups.cgi?testgroup_id=' +
        testcase.testgroups[i].testgroup_id + '">' +
        testcase.testgroups[i].name + ' (' +
        testcase.testgroups[i].testgroup_id + ')</a><br/>';            
    }
  } else {
    testgroups_display_text = '<span class="errorHeading">This testcase does not belong to any testgroups that are currently enabled.</span>';
  }
  testgroups_div.innerHTML = testgroups_display_text;

  resetTable('tblNewSubgroups');
  if (testcase.subgroups && testcase.subgroups.length > 0) {
    for (var i=0; i<testcase.subgroups.length; i++) {
      addRowToTestcaseTable('tblNewSubgroups',testcase.subgroups[i].testgroup_id,testcase.subgroups[i].subgroup_id);
      subgroups_display_text += '<a target="manage_subgroups" href="manage_subgroups.cgi?subgroup_id=' +
        testcase.subgroups[i].subgroup_id + '">' + testcase.subgroups[i].name +
        ' (' + testcase.subgroups[i].subgroup_id + ')</a><br/>';            
    }
  } else {
    subgroups_display_text = '<span class="errorHeading">This testcase does not belong to any subgroups that are currently enabled.</span>';
    addRowToTestcaseTable('tblNewSubgroups');
  }
  subgroups_div.innerHTML = subgroups_display_text;

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
  updatePersistVars();
  document.getElementById('enabled').checked = true;
  document.getElementById('communityenabled').checked = true;
  document.getElementById('testcase_id_display').innerHTML = '';
  document.getElementById('creation_date').innerHTML = '';
  document.getElementById('last_updated').innerHTML = '';
  document.getElementById('litmus_version').innerHTML = '';
  changeProduct();
  resetTable('tblNewSubgroups');
  addRowToTestcaseTable('tblNewSubgroups');
}

function switchToAdd() {
  disableModeButtons();
  blankTestcaseForm('edit_testcase_form');
  var productBox = document.getElementById('product');
  loadProducts(productBox,'',1);
  var productfilter = document.getElementById('product_filter');
  if (productfilter.selectedIndex) {
    var productId = productfilter.options[productfilter.selectedIndex].value;
    for (var i=0; i<productBox.options.length; i++) {
      if (productBox.options[i].value == productId) {
        productBox.options[i].selected = true;
        break;
      }
    }
  }
  changeProduct();
  var branchBox = document.getElementById('branch');
  var branchfilter = document.getElementById('branch_filter');
  if (branchfilter.selectedIndex) {
    var branchId = branchfilter.options[branchfilter.selectedIndex].value;
    for (var i=0; i<branchBox.options.length; i++) {
      if (branchBox.options[i].value == branchId) {
        branchBox.options[i].selected = true;
        changeBranchForTestcase();
        break;
      }
    }
  }
  setAuthor(current_user_id);
  document.getElementById('submit').value = 'Add Testcase';
  document.getElementById('mode').value = 'add';
  enableForm('edit_testcase_form');
  document.getElementById('testcase_display_div').style.display = 'none';
  document.getElementById('testcase_id_display_edit').innerHTML = '<em>Automatically generated for a new testcase</em>';
  document.getElementById('creation_date').innerHTML = '<em>Automatically generated for a new testcase</em>';
  document.getElementById('last_updated').innerHTML = '<em>Automatically generated for a new testcase</em>';
  document.getElementById('litmus_version').innerHTML = '<em>Automatically generated for a new testcase</em>';
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
  return 'https://bugzilla.mozilla.org/show_bug.cgi?id=' + bugID;
}

function updatePersistVars() {
  var productBox = document.getElementById('product_filter');
  var branchBox = document.getElementById('branch_filter');
  var testgroupBox = document.getElementById('testgroup_filter');
  var subgroupBox = document.getElementById('subgroup_filter');
  if (productBox.selectedIndex) {
    var productPersist = document.getElementById('product_persist');
    productPersist.value = productBox.options[productBox.selectedIndex].value;
  }
  if (branchBox.selectedIndex) {
    var branchPersist = document.getElementById('branch_persist');
    branchPersist.value = branchBox.options[branchBox.selectedIndex].value;
  }
}

function changeTestgroupFirstPass(mySuffix,silent) {
  if (!mySuffix) {
    mySuffix=suffix;
  }	
  var subgroupBox = document.getElementById('subgroup'+mySuffix);
  if (subgroupBox) {
    loadSubgroupsFirstPass(subgroupBox,mySuffix,silent);
  }
}

function loadSubgroupsFirstPass(subgroupBox,mySuffix,silent) {
  if (!mySuffix) {
    mySuffix=suffix;
  }
  var testgroupBox = document.getElementById('testgroup'+mySuffix);
  var testgroupId = testgroupBox.options[testgroupBox.selectedIndex].value;
  if (!testgroupId) {
    // No testgroup selected.
    return undefined;
  }
  disableForm(formName);
  if (!silent) {
    toggleMessage('loading','Loading Subgroups...');
  }
  var url = 'json.cgi?testgroup_id=' + testgroupId;
  return fetchJSON(url,populateSubgroupsFirstPass,silent);
}

function populateSubgroupsFirstPass(data) {
  testgroup=data;

  if (typeof(subgroupBox) == "undefined") {
    subgroupBox = document.getElementById('subgroup'+suffix);
  }

  clearSelect(subgroupBox);
  addNullEntry(subgroupBox);
  if (testgroup) {
    for (var i=0; i<testgroup.subgroups.length; i++) {
      var optionText = testgroup.subgroups[i].name + ' (' + testgroup.subgroups[i].subgroup_id + ')';
      subgroupBox.options[subgroupBox.length] = new Option(optionText,
                                                         testgroup.subgroups[i].subgroup_id);
    }
  }
  if (initial_subgroup) {
    setSelected(subgroupBox,initial_subgroup);
    initial_subgroup=0;
  }
  toggleMessage('loading','Filtering testcase list...');
  filterList();
  toggleMessage('none');
  enableForm(formName);
}

function addRowToTestcaseTable(tblName,testgroupId,subgroupId) {
  // Only add a new row if testgroups have already been defined by selecting
  // a product/branch.
  var tbl = document.getElementById(tblName);
  var lastRow = tbl.rows.length;
  // if there's no header row in the table, then iteration = lastRow + 1
  var iteration = lastRow;
  var row = tbl.insertRow(lastRow);
  var branchBox = document.getElementById('branch');
  if (branchBox.selectedIndex <= 0) {
    var cellNew = row.insertCell(0);  
    cellNew.setAttribute('rowspan','4');
    cellNew.setAttribute('class','errorHeading');
    cellNew.innerHTML = 'Please select a product and branch first.';
    return;
  }
  var branchId = branchBox.options[branchBox.selectedIndex].value;
 
  // Testgroup cell
  var cellTestgroup = row.insertCell(0);
  var el = document.createElement('select');
  el.setAttribute('name', 'testgroup_new_' + iteration);
  el.setAttribute('id', 'testgroup_new_' + iteration);
  el.setAttribute('size', '1');
  el.setAttribute('onChange', "changeTestgroupForTestcase('_new_"+iteration+"')");
  el.setAttribute('class', 'select_testgroup');
  el.options[0] = new Option('-Testgroup (ID#)-','');
  var j=1;
  for (i=0;i<testgroups.length;i+=1) {
    if (testgroups[i].branch_id == branchId) {
      el.options[j] = new Option(testgroups[i].name+' ('+testgroups[i].testgroup_id+')',testgroups[i].testgroup_id);
      if (testgroupId && testgroups[i].testgroup_id == testgroupId) {
        el.options[j].selected = true;
      }
      j++;
    }
  }
  cellTestgroup.setAttribute('valign','middle');
  cellTestgroup.appendChild(el);

  // Subgroup cell
  var cellSubgroup = row.insertCell(1);
  var el = document.createElement('select');
  el.setAttribute('name', 'subgroup_new_' + iteration);
  el.setAttribute('id', 'subgroup_new_' + iteration);
  el.setAttribute('size', '1');
  //el.setAttribute('onChange', "changeSubgroup('_new_"+iteration+"')");
  el.setAttribute('class', 'select_subgroup');
  el.options[0] = new Option('-Subgroup (ID#)-','');
  j=0;
  if (testgroupId && subgroupId) {
    for (i=0;i<subgroups.length;i+=1) {
      if (subgroups[i].testgroup_id == testgroupId) {
        el.options[j] = new Option(subgroups[i].name+' ('+subgroups[i].subgroup_id+')',subgroups[i].subgroup_id);
        if (subgroups[i].subgroup_id == subgroupId) {
          el.options[j].selected = true;
        }
      j++;
      }
    }
  }

  cellSubgroup.setAttribute('valign','middle');
  cellSubgroup.appendChild(el);
  
  var cellRemoveButton = row.insertCell(2);
  var el = document.createElement('input');
  el.setAttribute('type', 'button');
  el.setAttribute('name', 'remove_row_new_' + iteration);
  el.setAttribute('id', 'remove_row_new_' + iteration);
  el.setAttribute('class', 'button');
  el.setAttribute('onClick', "removeRowFromTable('"+tblName+"');");
  el.setAttribute('value', '-');
  cellRemoveButton.setAttribute('valign','top');
  cellRemoveButton.appendChild(el);

  var cellAddButton = row.insertCell(3);
  var el = document.createElement('input');
  el.setAttribute('type', 'button');
  el.setAttribute('name', 'add_row_new_' + iteration);
  el.setAttribute('id', 'add_row_new_' + iteration);
  el.setAttribute('class', 'button');
  el.setAttribute('onClick', "addRowToTestcaseTable('"+tblName+"');");
  el.setAttribute('value', '+');
  cellAddButton.setAttribute('valign','top');
  cellAddButton.appendChild(el);
}

function changeBranchForTestcase(silent) {
  resetTable('tblNewSubgroups');
  addRowToTestcaseTable('tblNewSubgroups');
  var testgroupBox = document.getElementById('testgroup_new_1');
  if (testgroupBox) {
    loadTestgroups(testgroupBox,'',silent);
  }
}

function changeTestgroupForTestcase(mySuffix,silent) {
  if (!mySuffix) {
    mySuffix=suffix;
  }
  var testgroupBox = document.getElementById('testgroup'+mySuffix);
  var subgroupBox = document.getElementById('subgroup'+mySuffix);
  var testgroupId = testgroupBox.options[testgroupBox.selectedIndex].value;
  clearSelect(subgroupBox);
  addNullEntry(subgroupBox);
  if (!testgroupId) {
    // No testgroup selected.
    return undefined;
  }
  disableForm(formName);
  if (!silent) {
    toggleMessage('loading','Loading Subgroups...');
  }
  if (subgroups) {
    for (var i=0; i<subgroups.length; i++) {
      if (subgroups[i].testgroup_id == testgroupId) {
        var optionText = subgroups[i].name + ' (' + subgroups[i].subgroup_id + ')';
        subgroupBox.options[subgroupBox.length] = new Option(optionText,
                                                             subgroups[i].subgroup_id);
      }
    }
  }
  FormInit(document.forms[formName], document.location.search, 'subgroup'+suffix);
  toggleMessage('none');
  enableForm(formName);
}

