if (!suffix) { 
  var suffix="";
}

function getProductById(productId) {
  for (var i=0; i<products.length; i++) {
    if (products[i].product_id == productId) {
      return (products[i]);
    }
  }
}

function getTestgroupById(testgroupId) {
  for (var i=0; i<testgroups.length; i++) {
    if (testgroups[i].testgroup_id == testgroupId) {
      return (testgroups[i]);
    }
  }
}

function getPlatformById(platformId) {
  for (var i=0; i<platforms.length; i++) {
    if (platforms[i].platform_id == platformId) {
      return (platforms[i]);
    }
  }
}

// pass this the <input> containing the list of possible default values
// and the current value, returns true if the current value appears in 
// defaultInput, otherwise returns false
function isDefault(defaultInput, curValue) {
  if (! defaultInput) { 
    return false;
  }
  var defaultArray = defaultInput.value.split(',');
  for (var i=0; i<defaultArray.length; i++) {
    if (defaultArray[i] == curValue) { 
      return true; 
    }
  }
  return false;
}

function clearSelect(select) {
  select.options.length = 0;
}

function addNullEntry(select) {
  // add a blank entry to the current select
  // if possible, try to make the null entry reflect the select's 
  // contents based on it's name:

  if (select.className == 'select_product') {
    select.add(new Option("-Product (ID#)-", "", false, false), null);
  } else if (select.className == 'select_branch') {
    select.add(new Option("-Branch (ID#)-", "", false, false), null);
  } else if (select.className == 'select_test_run') {
    select.add(new Option("-Test Run (ID#)-", "", false, false), null);
  } else if (select.className == 'select_testgroup') {
    select.add(new Option("-Testgroup (ID#)-", "", false, false), null);
  } else if (select.className == 'select_subgroup') {
    select.add(new Option("-Subgroup (ID#)-", "", false, false), null);
  } else if (select.className == 'select_testcase') {
    select.add(new Option("-ID#: Testcase Summary-", "", false, false), null);
  } else if (select.className == 'select_platform') {
    select.add(new Option("-Platform (ID#)-", "", false, false), null);
  } else if (select.className == 'select_opsys') {
    select.add(new Option("-Operating System (ID#)-", "", false, false), null);
  } else {
    select.add(new Option("---", "", false, false), null);
  }
}

function selectsOnLoad(mySuffix,silent) {
  if (!mySuffix) {
    mySuffix=suffix;
  }	
  var productBox = document.getElementById('product'+mySuffix);  
  loadProducts(productBox,mySuffix,silent);
}

function loadProducts(productBox,mySuffix,silent) {
  if (!productBox) {
    return;
  }
  if (!mySuffix) {
    mySuffix=suffix;
  }	
  disableForm(formName);
  clearSelect(productBox);
  addNullEntry(productBox);
  if (products) {
    for (var i=0; i<products.length; i++) {
      var option = new Option(products[i].name + " (" + products[i].product_id + ")",products[i].product_id, false, false)
      productBox.add(option, null);
      // handle the default selection
      if (isDefault(document.getElementById(productBox.name+"_default"), products[i].product_id)) {
	 productBox.selectedIndex = i+1;
      }
    }
  }
  enableForm(formName);
}

function changeProduct(mySuffix,silent) {
  if (!mySuffix) {
    mySuffix=suffix;
  }
  var branchBox = document.getElementById('branch'+mySuffix);
  if (branchBox) {
    loadBranches(branchBox,mySuffix,silent);
  }
}

function loadBranches(branchBox,mySuffix,silent) {
  if (!branchBox) {
    return;
  }
  if (!mySuffix) {
    mySuffix=suffix;
  }	
  disableForm(formName);
  clearSelect(branchBox);
  addNullEntry(branchBox);
  var productBox = document.getElementById('product'+mySuffix);
  var productId = productBox.options[productBox.selectedIndex].value;
  if (!productId) {
    // No product selected.
    enableForm(formName);
    return;
  }
  if (branches) {
    for (var i=0; i<branches.length; i++) {
      if (branches[i].product_id == productId) {
        var option = new Option(branches[i].name + ' (' + branches[i].branch_id + ')', branches[i].branch_id, false, false)
        branchBox.add(option, null);
        // handle the default selection
        if (isDefault(document.getElementById(branchBox.name+"_default"), branches[i].branch_id)) {
          branchBox.selectedIndex = i+1;
        }        
      }
    }
  }
  enableForm(formName);
}

function changeBranch(mySuffix,silent) {
  if (!mySuffix) {
    mySuffix=suffix;
  }	
  var testgroupBox = document.getElementById('testgroup'+mySuffix);
  if (testgroupBox) {
    loadTestgroups(testgroupBox,mySuffix,silent);
  }
}

function loadTestgroups(testgroupBox,mySuffix,silent) {
  if (!mySuffix) {
    mySuffix=suffix;
  }	
  disableForm(formName);
  clearSelect(testgroupBox);
  addNullEntry(testgroupBox);

  var productBox = document.getElementById('product'+mySuffix);
  var productId = productBox.options[productBox.selectedIndex].value;
  var branchBox = document.getElementById('branch'+mySuffix);
  var branchId = branchBox.options[branchBox.selectedIndex].value;
  if (testgroups) {
    for (var i=0; i<testgroups.length; i++) {
      if ((branchId && testgroups[i].branch_id == branchId) ||
	  (!branchId && productId && testgroups[i].product_id == productId) ||
	  (!branchId && !productId)) {
        var option = new Option(testgroups[i].name + ' (' + testgroups[i].testgroup_id + ')', testgroups[i].testgroup_id);
        testgroupBox.add(option, null);
        if (isDefault(document.getElementById(testgroupBox.name+"_default"), testgroups[i].testgroup_id)) {
          testgroupBox.selectedIndex = i+1;
        }
      }
    }
  }
  enableForm(formName);
}

function changeTestgroup(mySuffix,silent) {
  if (!mySuffix) {
    mySuffix=suffix;
  }	
  var subgroupBox = document.getElementById('subgroup'+mySuffix);
  if (subgroupBox) {
    loadSubgroups(subgroupBox,mySuffix,silent);
  }
}

function loadSubgroups(subgroupBox,mySuffix,silent) {
  if (!mySuffix) {
    mySuffix=suffix;
  }
  var testgroupBox = document.getElementById('testgroup'+mySuffix);
  var testgroupId = testgroupBox.options[testgroupBox.selectedIndex].value;
  if (!testgroupId) {
    // No testgroup selected.
    return;
  }
  disableForm(formName);
  if (!silent) {
    toggleMessage('loading','Loading Subgroups...');
  }
  var url = 'json.cgi?testgroup_id=' + testgroupId;
  fetchJSON(url,populateSubgroups,silent);
}

function populateSubgroups(data) {
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
  toggleMessage('none');
  FormInit(document.forms[formName], document.location.search);
  enableForm(formName);
}

function changeSubgroup(mySuffix,silent) {
  if (!mySuffix) {
    mySuffix=suffix;
  }	
  var testcaseBox = document.getElementById('testcase'+mySuffix);
  if (testcaseBox) {
    loadTestcases(testcaseBox,mySuffix,silent);
  }
}

function loadTestcases(testcaseBox,mySuffix,silent) {
  if (!mySuffix) {
    mySuffix=suffix;
  }	
  var subgroupBox = document.getElementById('subgroup'+mySuffix);
  var subgroupId = subgroupBox.options[subgroupBox.selectedIndex].value;
  if (!subgroupId) {
    // No subgroup selected.
    return;
  }

  disableForm(formName);
  if (!silent) {
    toggleMessage('loading','Loading Testcases...');
  }
  var url = 'json.cgi?subgroup_id=' + subgroupId;
  fetchJSON(url,populateTestcases,silent);
}

function populateTestcases(data,mySuffix) {
  if (!mySuffix) {
    mySuffix=suffix;
  }	
  subgroup=data;

  var testcaseBox = document.getElementById('testcase'+mySuffix);
  clearSelect(testcaseBox);
  addNullEntry(testcaseBox);
  for (var i=0; i<subgroup.testcases.length; i++) {
    var optionText = subgroup.testcases[i].summary + ' (' + subgroup.testcases[i].testcase_id + ')';
    testcaseBox.options[testcaseBox.length] = new Option(optionText,
                                                         subgroup.testcases[i].testcase_id);
  }
  toggleMessage('none');
  FormInit(document.forms[formName], document.location.search);
  enableForm(formName);
}

function changePlatform(mySuffix,silent) {
  if (!mySuffix) {
    mySuffix=suffix;
  }	
  var opsysBox = document.getElementById("opsys"+mySuffix);
  if (opsysBox) {
    loadOpsyses(opsysBox,mySuffix,silent);
  }
}

function loadOpsyses(opsysBox,mySuffix,silent) {
  if (!opsysBox) {
    return;
  }
  if (!mySuffix) {
    mySuffix=suffix;
  }	
  clearSelect(opsysBox);
  addNullEntry(opsysBox);
  var platformBox = document.getElementById('platform'+mySuffix);
  var platformId = platformBox.options[platformBox.selectedIndex].value;
  if (!platformId) {
    // No platform selected.
    return;
  }
  if (opsyses) {
    for (var i=0; i<opsyses.length; i++) {
      if (opsyses[i].platform_id == platformId) {
        var option = new Option(opsyses[i].name + ' (' + opsyses[i].opsys_id + ')', opsyses[i].opsys_id, false, false)
        opsysBox.add(option, null);
        // handle the default selection
        if (isDefault(document.getElementById(opsysBox.name+"_default"), opsyses[i].opsys_id)) {
          opsysBox.selectedIndex = i+1;
        }        

      }
    }
  }
}

function populateBranches(branchBox,productBox) {
  if (!branchBox) {
    return;
  }
  branchBox.options.length = 0;
  
  var productId = productBox.options[productBox.selectedIndex].value;
  var product = getProductById(productId);
  if (!product) {
    // no product set
    var option = new Option('-No product selected-','');
    branchBox.add(option, null);
    return;
  }
  var option = new Option('-Branch (ID#)-','');
  branchBox.add(option, null);
  for (var i=0; i<branches.length; i++) {
    if (branches[i].product_id == productId) {
      var option = new Option(branches[i].name + ' (' + branches[i].branch_id + ')',branches[i].branch_id);
      option.selected = false;
      branchBox.add(option, null);
    }
  }
}

function setSelected(selectBox,selectedValue) {
  var options = selectBox.getElementsByTagName('option');
  var found_selected = 0;
  for (var i=0; i<options.length; i++) {
    if (options[i].value == selectedValue) {
      options[i].selected = true;
      found_selected=1;
    } else {
      options[i].selected = false;
    }
  }
  if (found_selected == 0) {
    options[0].selected = true;
  } 
  return found_selected;
}