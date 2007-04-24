function MM_findObj(n, d) { //v4.01
  var p,i,x;  if(!d) d=document; if((p=n.indexOf("?"))>0&&parent.frames.length) {
    d=parent.frames[n.substring(p+1)].document; n=n.substring(0,p);}
  if(!(x=d[n])&&d.all) x=d.all[n]; for (i=0;!x&&i<d.forms.length;i++) x=d.forms[i][n];
  for(i=0;!x&&d.layers&&i<d.layers.length;i++) x=MM_findObj(n,d.layers[i].document);
  if(!x && d.getElementById) x=d.getElementById(n); return x;
}

function showsubgroup() {
  var groupselect = MM_findObj("testgroup");
  
  if (!groupselect) {
    return;
  }
  
  var selnum;

  if (groupselect.value) {
    selnum = groupselect.value;
  } else {
    for (var i=0; i<groupselect.length; i++) {
      if (groupselect[i].checked) {
        selnum = groupselect[i].value;
      }
    }
    if (!selnum) {
      groupselect[0].checked = true;
      selnum = groupselect[0].value;
    }
  }

  // object to show
  var obj = MM_findObj("divsubgroup_"+selnum);

  // disable all of them
  for (var i=0; i<groupselect.length; i++) {
    var gnum = groupselect[i].value;
    var disableobj = MM_findObj("divsubgroup_"+gnum);
    disableobj.style.display = "none";
  }
  MM_findObj("divsubgroup_null").style.display = "none";

  var num_subgroups_enabled = 0;
  var subgroupselect = MM_findObj("subgroup_"+selnum);

  if (!subgroupselect) {
    return;
  }
  
  if (subgroupselect.value) {
    num_subgroups_enabled=1;
  } else {
    for (var i=0; i<subgroupselect.length; i++) {
      if (!subgroupselect[i].disabled) {
        num_subgroups_enabled++;
       }
    }
  }

  obj.style.display = "";

  if (num_subgroups_enabled == 0) {
    MM_findObj("Submit").disabled = true;
  } else {
    MM_findObj("Submit").disabled = false;
  }

}

function group_init(testgroup_id) {
  testConfigHeight = new fx.Height('test_run_summary', {duration: 400});
  testConfigHeight.toggle();
    
  if (testgroup_id) {
    var testgroups = document.getElementsByName('testgroup');
    for (var i=0; i<testgroups.length; i++) {
      if (testgroups[i].value == testgroup_id) {
        testgroups[i].checked = true;            
      } else {
        testgroups[i].checked = false;
      }
    }
  }
}
